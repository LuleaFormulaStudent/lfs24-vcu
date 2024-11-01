import Main from "../main";
import {common} from "node-mavlink";
import {CoolantPump} from "mavlink-lib/typescript/lfs";

export default class CoolantSystemController {

    constructor(private main: Main) {
    }

    async init() {
        await this.main.logs_controller.debug("Mavlink controller initialized!")
    }

    setCoolantPump(value: boolean, send: boolean = true) {
        this.main.digital_outputs_controller.setCoolantPumpSwitch(value)
        if (send) {
            const msg = new CoolantPump()
            msg.state = this.main.data_controller.params.cool_pump_output
            msg.startupState = this.main.data_controller.params.cool_pump_start
            this.main.mavlink_controller.send(msg).catch(async () => {
                await this.main.logs_controller.error("Sending coolant pump message failed!")
            })
        }
        if (value) {
            this.main.logs_controller.info("Activating coolant pump")
        } else {
            this.main.logs_controller.info("Deactivating coolant pump")
        }
    }

    async handleCoolantPumpCmd(data: common.CommandLong) {
        if (data._param1 > 0) {
            this.setCoolantPump(data._param1 == 2)
        }
        if (data._param2 > 0) {
            this.main.data_controller.params.cool_pump_start = data._param2 == 2
            this.main.data_controller.saveParam("cool_pump_start", data._param2 == 2)
            await this.main.logs_controller.info("Changing behavior for coolant pump on startup: " + (data._param2 == 2))
        }
    }

}