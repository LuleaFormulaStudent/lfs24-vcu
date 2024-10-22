import MavlinkRouter from "./mavlink_router";
import {common, sleep} from "node-mavlink";
import fs from "fs";
import path from "path";
import {MavSeverity} from "mavlink-mappings/dist/lib/common.js";

export default class LogsController {

    logs: { id: number, text: string, severity: common.MavSeverity }[] = []
    log_id: number = -1
    logs_path: string = (process.env.LOGS_PATH + "/mavlink-router") || ""

    constructor(private main: MavlinkRouter) {
        if (this.logs_path.length && !fs.existsSync(this.logs_path)) {
            fs.mkdirSync(this.logs_path)
        }
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

    log(text: string, severity: MavSeverity, log_fn = console.log, err: any = null,) {
        const date = new Date(Date.now())
        const severity_text = MavSeverity[severity].toString()
        if (err) {
            text += " " + (err.hasOwnProperty("msg")? err.msg: err.toString()).toString()
        }
        log_fn(`[${this.formatCurrentDate(date)} ${this.getTime(date)}] [${severity_text}]`, text, err ? err : "")
        this.log_id++
        this.logs.push({id: this.log_id, severity: severity, text})

        const log_text = `[${this.formatCurrentDate(date)} ${this.getTime(date)}] [MAVLINK ROUTER] [${severity_text}] ` + text
        this.writeToFile(`full_` + this.formatCurrentDate(date) + ".log", log_text)
        this.writeToFile(`${severity_text.toLowerCase()}_` + this.formatCurrentDate(date) + ".log", log_text)
        if (err) {
            this.writeToFile(`error_` + this.formatCurrentDate(date) + ".log", err.toString())
        }
    }

    info(text: string) {
        this.log(text, MavSeverity.INFO)
    }

    debug(text: string) {
        this.log(text, MavSeverity.DEBUG)
    }

    warning(text: string) {
        this.log(text, MavSeverity.WARNING, console.warn)
    }

    error(text: string, err: any = null) {
        this.log(text, MavSeverity.ERROR, console.error, err)
    }
}