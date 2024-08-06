import DS3502 from "../../libs/DS3502/DS3502.js";
import Main from "../../main.js";

export default class ThrottleController {

    private device: DS3502

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.device = new DS3502(0x28)
        }
    }

    async init() {
        this.main.data_controller.addParamListener("throttle_input", ({value}) => {
            this.main.data_controller.params.throttle_output = value * this.main.data_controller.params.throttle_max_val
        })

        this.main.data_controller.addParamListener("throttle_output", ({value}) => {
            if (value > this.main.data_controller.params.foot_switch_act) {
                this.main.digital_outputs_controller.setFootSwitch(true)
            } else {
                this.main.digital_outputs_controller.setFootSwitch(false)
            }

            if (this.main.in_production && this.main.data_controller.params.throttle_enable) {
                this.device.write(value)
            }
        })
    }
}