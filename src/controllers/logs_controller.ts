import Main from "../../main.js";
import {common} from "node-mavlink";
import {sleep} from "../helper_functions.js";
import fs from "fs";
import path from "path";
import {MavSeverity} from "mavlink-mappings/dist/lib/common.js";

export default class LogsController {

    logs: { id: number, text: string, severity: common.MavSeverity }[] = []
    log_id: number = -1
    ready_to_send = false

    chunk_size = 47

    logs_path: string = process.env.LOGS_PATH || ""

    constructor(private main: Main) {
        if (this.logs_path.length && !fs.existsSync(this.logs_path)) {
            fs.mkdirSync(this.logs_path)
        }
    }

    async init() {

    }

    formatCurrentDate(date: Date): string {
        return `${date.getFullYear()}-${(date.getMonth() < 9 ? "0" : "") + (date.getMonth() + 1)}-${(date.getDate() <= 9 ? "0" : "") + date.getDate()}`
    }

    getTime(date: Date): string {
        return `${(date.getHours() <= 9 ? "0" : "") + date.getHours()}:${(date.getMinutes() <= 9 ? "0" : "") + date.getMinutes()}:${(date.getSeconds() <= 9 ? "0" : "") + date.getSeconds()}`
    }

    writeToFile(log_path: string, str: string) {
        const file_path = path.join(this.logs_path, log_path)
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

    async log(text: string, severity: MavSeverity, log_fn = console.log, err: any = null,) {
        const date = new Date(Date.now())
        const severity_text = MavSeverity[severity].toString()
        if (err) {
            text += " " + (err.hasOwnProperty("msg")? err.msg: err.toString()).toString()
        }
        log_fn(`[${this.formatCurrentDate(date)} ${this.getTime(date)}] [${severity_text}]`, text, err ? err : "")
        this.log_id++
        this.logs.push({id: this.log_id, severity: severity, text})

        if (this.ready_to_send) {
            await this.sendLogMsg(this.log_id, severity, text)
        }

        const log_text = `[${this.formatCurrentDate(date)} ${this.getTime(date)}] [${severity_text}] ` + text
        this.writeToFile(`main/full_` + this.formatCurrentDate(date) + ".log", log_text)
        this.writeToFile(`main/${severity_text.toLowerCase()}_` + this.formatCurrentDate(date) + ".log", log_text)
        if (err) {
            this.writeToFile(`main/error_` + this.formatCurrentDate(date) + ".log", err.toString())
        }
    }

    async info(text: string) {
        await this.log(text, MavSeverity.INFO)
    }

    async debug(text: string) {
        await this.log(text, MavSeverity.DEBUG)
    }

    async warning(text: string) {
        await this.log(text, MavSeverity.WARNING, console.warn)
    }

    async error(text: string, err: any = null) {
        await this.log(text, MavSeverity.ERROR, console.error, err)
    }

    private async sendLogMsg(id: number, severity: common.MavSeverity, text: string) {
        const chunks = Math.ceil(text.length / this.chunk_size)

        for (let chunk_id = 0; chunk_id < chunks; chunk_id++) {
            const msg = new common.StatusText()
            msg.severity = severity
            msg.id = id
            msg.text = text.substring(chunk_id * this.chunk_size, (chunk_id + 1) * this.chunk_size)
            msg.chunkSeq = chunk_id
            if (chunk_id >= chunks - 1) {
                msg.text += "<@>"
            }
            if (!await this.main.mavlink_controller.send(msg)) {
                console.log("Failed to send log")
            }
            if (chunk_id != chunks - 1) {
                await sleep(50)
            }
        }
    }

    async onLogListRequest(start_id: number, end_id: number) {
        try {
            this.ready_to_send = false
            const msg = new common.LogEntry()
            msg.id = this.log_id
            msg.numLogs = this.logs.length
            msg.lastLogNum = this.log_id
            await this.main.mavlink_controller.send(msg)
            await sleep(100)

            for (let i: number = start_id; i < Math.min(end_id + 1, this.logs.length); i++) {
                await this.sendLogMsg(this.logs[i].id, this.logs[i].severity, this.logs[i].text)
                await sleep(100)
            }
            this.ready_to_send = true
        } catch (err) {
            this.ready_to_send = true
            await this.error("Error when sending log list..", err)
        }
    }
}