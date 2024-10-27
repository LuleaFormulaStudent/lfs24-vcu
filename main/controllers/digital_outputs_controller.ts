import RelayBoard from "../libs/relay_board/relay_board.js";
import Main from "../main.js";
import {DigitalOutputsMessage} from "mavlink-lib/typescript/lfs.js"

export default class DigitalOutputsController {

    board: RelayBoard | null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.board = new RelayBoard()
        } else {
            this.board = null
        }
    }

    async init() {
        this.setCoolantPumpOutput(this.main.data_controller.params.cool_pump_start)
        await this.main.logs_controller.debug("Digital outputs controller initialized!")
        this.setReverseSwitch(false)
    }

    setFootSwitch(val: boolean) {
        if (val != this.main.data_controller.params.fs_output) {
            this.main.data_controller.params.fs_output = val
            if (this.board) {
                this.board.setOutput(5, val)
            }
            this.sendDOMessage()
        }
    }

    setForwardSwitch(val: boolean, should_send: boolean = true) {
        if (val != this.main.data_controller.params.forward_output) {
            this.main.data_controller.params.forward_output = val
            if (this.board) {
                this.board.setOutput(6, val)
            }
            if (should_send) {
                this.sendDOMessage()
            }
        }
    }

    setReverseSwitch(val: boolean, should_send: boolean = true) {
        if (val != this.main.data_controller.params.reverse_output) {
            this.main.data_controller.params.reverse_output = val
            if (this.board) {
                this.board.setOutput(4, !val)
            }
            if (should_send) {
                this.sendDOMessage()
            }
        }
    }

    setCoolantPumpOutput(val: boolean) {
        if (val != this.main.data_controller.params.cool_pump_output) {
            this.main.data_controller.params.cool_pump_output = val
            if (this.board) {
                this.board.setOutput(8, val)
            }
            this.sendDOMessage()
        }
    }

    setBrakeLightOutput(val: boolean) {
        if (val != this.main.data_controller.params.brake_light_out) {
            this.main.data_controller.params.brake_light_out = val
            if (this.board) {
                this.board.setOutput(7, val)
            }
            this.sendDOMessage()
        }
    }

    setTSActiveRelay(val: boolean) {
        if (val != this.main.data_controller.params.ts_active_out) {
            this.main.data_controller.params.ts_active_out = val
            if (this.board) {
                this.board.setOutput(2, val)
            }
            this.sendDOMessage()
        }
    }

    sendDOMessage() {
        const msg = new DigitalOutputsMessage()
        msg.redLedOutput = this.main.data_controller.params.red_led_output
        msg.greenLedOutput = this.main.data_controller.params.green_led_output
        msg.blueLedOutput = this.main.data_controller.params.blue_led_output
        msg.tsActive = this.main.data_controller.params.ts_active_out
        msg.fsOutput = this.main.data_controller.params.fs_output
        msg.forwardSwitch = this.main.data_controller.params.forward_output
        msg.reverseSwitch = this.main.data_controller.params.reverse_output
        msg.brakeLight = this.main.data_controller.params.brake_light_out
        msg.coolantPumpOut = this.main.data_controller.params.cool_pump_output
        this.main.mavlink_controller.send(msg).catch(async () => {
            await this.main.logs_controller.error("Sending digital outputs message failed!")
        })
    }
}
