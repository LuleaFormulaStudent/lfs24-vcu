import path from "path";
import fs from "fs";

export default class Logger {
    LOG_PREFIX: string
    TABS: number = 0

    PRINT_DATE: boolean = false
    WRITE_TO_FILE: boolean = false

    static LOG_PATH = "./logs"
    static instance_names: number[] = []

    setLogPrefix(instance: any | string) {
        if (typeof instance == "string") {
            this.LOG_PREFIX = "[" + instance + "]"
        } else {
            const name: string = instance.constructor.name
            this.LOG_PREFIX = "[" + name.split("")
                .map((c, index) => c.toUpperCase() == c && index > 0? ` ${c}`: c)
                .join("").toUpperCase() + "]"
            Logger.instance_names.push(this.LOG_PREFIX.length)
        }
    }

    static init() {
        if (!fs.existsSync(Logger.LOG_PATH)) {
            fs.mkdirSync(Logger.LOG_PATH)
        }
    }

    async writeToFile(log_path: string, str: string) {
        const file_path = path.join(Logger.LOG_PATH, log_path)
        const file_path_base = path.dirname(file_path)
        if (!fs.existsSync(file_path_base)) {
            fs.mkdirSync(file_path_base)
        }

        if (fs.existsSync(file_path)) {
            fs.appendFileSync(file_path, str + "\n", {encoding: "utf-8"})
        } else {
            fs.writeFileSync(file_path, str + "\n", {encoding: "utf-8"})
        }

    }

    formatCurrentDate(date: Date) {
        return `${date.getFullYear()}-${date.getMonth() < 9? "0"+ date.getMonth() + 1: date.getMonth() + 1}-${date.getDate() <= 9? "0"+ date.getDate():date.getDate()}`
    }

    getTime(date: Date) {
        return `${date.getHours() <= 9? "0"+ date.getHours():date.getHours()}:${date.getMinutes() <= 9? "0"+ date.getMinutes():date.getMinutes()}:${date.getSeconds() <= 9? "0"+ date.getSeconds():date.getSeconds()}`
    }

    log(data: any) {
        const date = new Date(Date.now())
        if (this.PRINT_DATE) {
            console.log(`[${this.formatCurrentDate(date)} ${this.getTime(date)}]\x1b[32m [INFO]\x1b[34m  ${this.LOG_PREFIX}${"\t".repeat(this.TABS)}\x1b[37m`, data)
        } else {
            console.log(`\x1b[32m[INFO]\x1b[34m ${this.LOG_PREFIX}${"\t".repeat(this.TABS)}\x1b[37m`, data)
        }
        if (this.WRITE_TO_FILE) {
            this.writeToFile("main/info_" + this.formatCurrentDate(date) + ".log",
                `[${this.formatCurrentDate(date)} ${this.getTime(date)}] [INFO]  [${this.LOG_PREFIX}] ${"\t".repeat(this.TABS)}   `+ data.toString())
        }
    }

    error(data: any) {
        const date = new Date(Date.now())
        if (this.PRINT_DATE) {
            console.log(`[${this.formatCurrentDate(date)} ${this.getTime(date)}]\x1b[31m [ERROR]\x1b[34m ${this.LOG_PREFIX}${"\t".repeat(this.TABS)}\x1b[37m`, data)
        } else {
            console.log(`[ERROR]\x1b[34m ${this.LOG_PREFIX}${"\t".repeat(this.TABS)}\x1b[37m`, data)
        }

        if (this.WRITE_TO_FILE) {
            this.writeToFile("main/error_" + this.formatCurrentDate(date) + ".log",
                `[${this.formatCurrentDate(date)} ${this.getTime(date)}] [ERROR] ${this.LOG_PREFIX}${"\t".repeat(this.TABS)} `+ data.toString())
        }
    }
}