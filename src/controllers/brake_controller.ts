import DS3502 from "../../libs/DS3502/DS3502.js";
import Main from "../../main.js";

export default class BrakeController {

    device: DS3502

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.device = new DS3502(0x29)
            this.device.on("error", (err) => this.main.logs_controller.error("Error with i2c Device:", err))
        }
        this.main.logs_controller.debug("Brake controller constructor initialized!")
    }

    async init() {
        if (this.main.in_production) {
            await this.device.setDefault(0);
        }

        this.main.data_controller.addParamListener("brake_input", ({value}) => {
            this.main.data_controller.params.brake_output = value
        })

        this.main.data_controller.addParamListener("brake_output", ({value}) => {
            this.main.digital_outputs_controller.setBrakeLightOutput(value > this.main.data_controller.params.brake_light_act)
        })
    }
}