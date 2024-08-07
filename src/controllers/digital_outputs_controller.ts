import RelayBoard from "../../libs/relay_board/relay_board.js";
import Main from "../../main.js";

export default class DigitalOutputsController  {

    board: RelayBoard

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.board = new RelayBoard()
        }
        this.main.logs_controller.debug("Digital output controller constructor initialized!")
    }

    async init() {
        if (this.main.data_controller.params.cool_pump_start) {
            this.setCoolantPumpOutput(true)
        }
    }

    setFootSwitch(val: boolean) {
        this.main.data_controller.params.fs_output = val
        if (this.main.in_production) {
            this.board.setOutput(5, val)
        }
    }

    setForwardSwitch(val: boolean) {
        this.main.data_controller.params.forward_output = val
        if (this.main.in_production) {
            this.board.setOutput(6, val)
        }
    }

    setReverseSwitch(val: boolean) {
        this.main.data_controller.params.reverse_output = val
        if (this.main.in_production) {
            this.board.setOutput(4, val)
        }
    }

    setCoolantPumpOutput(val: boolean) {
        this.main.data_controller.params.cool_pump_output = val
        if (this.main.in_production) {
            this.board.setOutput(8, val)
        }
    }

    setBrakeLightOutput(val: boolean) {
        this.main.data_controller.params.brake_light_out = val
        if (this.main.in_production) {
            this.board.setOutput(7, val)
        }
    }
}