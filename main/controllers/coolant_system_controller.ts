import Main from "../main";
import {common} from "node-mavlink";

export default class CoolantSystemController {

    constructor(private main: Main) {
    }

    async init() {
        await this.main.logs_controller.debug("Mavlink controller initialized!")
    }

    async handleCoolantPumpCmd(data: common.CommandLong) {
        console.log(data)
        if (data._param1 > 0) {
            this.main.digital_outputs_controller.setCoolantPumpOutput(data._param1 == 1)
            if (data._param1 == 1) {
                await this.main.logs_controller.info("Activating coolant pump")
            } else {
                await this.main.logs_controller.info("Deactivating coolant pump")
            }
        }
        if (data._param2 > 0) {
            this.main.data_controller.params.cool_pump_start = data._param2 == 1
            this.main.data_controller.saveParam("cool_pump_start", data._param2 == 1)
            await this.main.logs_controller.info("Changing behavior for coolant pump on startup: " + (data._param2 == 1))
        }
    }

}