const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');

class ByinAPIClient {
    constructor() {
        this.headers = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://byin.fun",
            "Referer": "https://byin.fun/influence",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Waiting ${i} seconds to continue the loop =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    async login(initData) {
        const url = "https://byin.fun/api/tg/login";
        const payload = {
            initData: initData,
            id: JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0])).id,
            hash: initData.split('hash=')[1],
            username: JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0])).username,
            authDate: Math.floor(Date.now() / 1000),
            firstName: JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0])).first_name,
            lastName: JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0])).last_name,
            photoUrl: "",
            isPremium: "",
            inviteCode: ""
        };

        try {
            const response = await axios.post(url, payload, { headers: this.headers });
            if (response.status === 200 && response.data.code === 0) {
                return { 
                    success: true, 
                    token: response.data.data.token,
                    isNew: response.data.data.isNew
                };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async receiveCurrency(token) {
        const url = "https://byin.fun/api/currency/receive";
        const headers = { ...this.headers, "Token": token };
        try {
            const response = await axios.post(url, {}, { headers });
            if (response.status === 200 && response.data.code === 0) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAccountInfo(token) {
        const url = "https://byin.fun/api/account";
        const headers = { ...this.headers, "Token": token };
        try {
            const response = await axios.get(url, { headers });
            if (response.status === 200 && response.data.code === 0) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAndCompleteTasksForUser(token) {
        const taskTypes = [0, 1, 2];
        const joinTaskUrl = "https://byin.fun/api/task/join";
        const headers = { ...this.headers, "Token": token };

        for (const taskType of taskTypes) {
            const tasksUrl = `https://byin.fun/api/task/page?taskType=${taskType}&pageSize=10000&pageNum=1`;

            try {
                this.log(`Fetching tasks of type ${taskType}...`, 'info');
                const tasksResponse = await axios.get(tasksUrl, { headers });
                if (tasksResponse.status !== 200 || tasksResponse.data.code !== 0) {
                    throw new Error(`Failed to get tasks for type ${taskType}: ${tasksResponse.data.msg}`);
                }

                const unfinishedTasks = tasksResponse.data.data.list.filter(task => !task.hasFinish);
                this.log(`Found ${unfinishedTasks.length} unfinished tasks of type ${taskType}.`, 'info');

                for (const task of unfinishedTasks) {
                    try {
                        const joinResponse = await axios.post(joinTaskUrl, { id: task.id }, { headers });
                        if (joinResponse.status === 200 && joinResponse.data.code === 0) {
                            this.log(`Completed task ${task.taskName.yellow} (Type ${taskType}) successfully | Reward: ${task.reward.toString().magenta}`, 'custom');
                        } else {
                            this.log(`Failed to complete task ${task.taskName} (Type ${taskType}): ${joinResponse.data.msg}`, 'error');
                        }
                    } catch (error) {
                        this.log(`Error while completing task ${task.taskName} (Type ${taskType}): ${error.message}`, 'error');
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                this.log(`Completed all unfinished tasks of type ${taskType}.`, 'success');
            } catch (error) {
                this.log(`Error while fetching or completing tasks of type ${taskType}: ${error.message}`, 'error');
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.log(`Completed all types of tasks.`, 'success');
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initData = data[i];
                const userData = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0]));
                const userId = userData.id;
                const firstName = userData.first_name;

                console.log(`========== Account ${i + 1} | ${firstName.green} ==========`);
                
                this.log(`Logging in to account ${userId}...`, 'info');
                const loginResult = await this.login(initData);
                if (loginResult.success) {
                    this.log('Login successful!', 'success');
                    const token = loginResult.token;
                    
                    if (loginResult.isNew === 1) {
                        const receiveResult = await this.receiveCurrency(token);
                        if (receiveResult.success) {
                            this.log(`Successfully received currency!`, 'success');
                        } else {
                            this.log(`Failed to receive currency: ${receiveResult.error}`, 'error');
                        }
                    } else {
                        this.log(`Account is not new, skipping currency receipt.`, 'info');
                    }

                    const accountInfoResult = await this.getAccountInfo(token);
                    if (accountInfoResult.success) {
                        this.log(`Balance: ${accountInfoResult.data.totalQuantity}`, 'info');
                    } else {
                        this.log(`Failed to fetch account info: ${accountInfoResult.error}`, 'error');
                    }

                    await this.getAndCompleteTasksForUser(token);
                } else {
                    this.log(`Login failed! ${loginResult.error}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(1440 * 60);
        }
    }
}

const client = new ByinAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});