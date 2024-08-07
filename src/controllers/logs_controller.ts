import Main from "../../main.js";
import {common, send} from "node-mavlink";
import {sleep} from "../helper_functions.js";

export default class LogsController  {

    logs: {id: number, text: string, severity: common.MavSeverity}[] = []
    log_id: number = -1
    ready_to_send = false

    constructor(private main: Main) {
        this.main.logs_controller.info("Logs controller constructor initialized!")
    }

    async init() {

    }

    severity_text(severity: common.MavSeverity): string {
        switch(severity) {
            case common.MavSeverity.ALERT: return "[ALERT]"
            case common.MavSeverity.DEBUG: return "[DEBUG]"
            case common.MavSeverity.EMERGENCY: return "[EMERGENCY]"
            case common.MavSeverity.ERROR: return "[ERROR]"
            case common.MavSeverity.CRITICAL: return "[CRITICAL]"
            case common.MavSeverity.NOTICE: return "[NOTICE]"
            case common.MavSeverity.WARNING: return "[WARNING]"
            case common.MavSeverity.INFO: return "[INFO]"
            default: return "[DEFAULT]"
        }
    }

    async info(text: string) {
        console.log(this.severity_text(common.MavSeverity.INFO), text)
        this.log_id++
        this.logs.push({id: this.log_id, severity: common.MavSeverity.INFO, text})
        if (this.ready_to_send) {
            await this.sendLogMsg(this.log_id, common.MavSeverity.INFO, text)
        }
    }

    async debug(text: string) {
        console.log(this.severity_text(common.MavSeverity.DEBUG), text)
        this.log_id++
        this.logs.push({id: this.log_id, severity: common.MavSeverity.DEBUG, text})
        if (this.ready_to_send) {
            await this.sendLogMsg(this.log_id, common.MavSeverity.DEBUG, text)
        }
    }

    async warning(text: string) {
        console.log(this.severity_text(common.MavSeverity.WARNING), text)
        this.log_id++
        this.logs.push({id: this.log_id, severity: common.MavSeverity.WARNING, text})
        if (this.ready_to_send) {
            await this.sendLogMsg(this.log_id, common.MavSeverity.WARNING, text)
        }
    }

    async error(text: string, err: any = null) {
        console.error(this.severity_text(common.MavSeverity.ERROR), text, err != null? err : "")
        text += err != null? " " + err.toString() : ""
        this.log_id++
        this.logs.push({id: this.log_id, severity: common.MavSeverity.ERROR, text})
        if (this.ready_to_send) {
            await this.sendLogMsg(this.log_id, common.MavSeverity.ERROR, text)
        }
    }

    private async sendLogMsg(id: number, severity: common.MavSeverity, text: string,) {
        const chunks = Math.ceil(text.length / 50)
        for (let chunk_id = 0; chunk_id < chunks; chunk_id++) {
            const msg = new common.StatusText()
            msg.severity = severity
            msg.id = id
            msg.text = text.substring(chunk_id*50, (chunk_id + 1)*50)
            msg.chunkSeq = chunk_id
            await this.main.mavlink_controller.send(msg)
            if (chunk_id != chunks - 1) {
                await sleep(10)
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
                await sleep(50)
            }
            this.ready_to_send = true
        } catch(err) {
            this.ready_to_send = true
            await this.error("Error when sending log list..", err)
        }
    }
}