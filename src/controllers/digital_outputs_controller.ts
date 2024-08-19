import RelayBoard from "../../libs/relay_board/relay_board.js";
import Main from "../../main.js";

export default class DigitalOutputsController  {

    board: RelayBoard | null

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.board = new RelayBoard()
        } else {
            this.board = null
        }
    }

    async init() {
        if (this.main.data_controller.params.cool_pump_start) {
            this.setCoolantPumpOutput(true)
        }

        await this.main.logs_controller.debug("Digital outputs controller initialized!")
    }

    setFootSwitch(val: boolean) {
        this.main.data_controller.params.fs_output = val
        if (this.board) {
            this.board.setOutput(5, val)
        }
    }

    setForwardSwitch(val: boolean) {
        this.main.data_controller.params.forward_output = val
        if (this.board) {
            this.board.setOutput(6, val)
        }
    }

    setReverseSwitch(val: boolean) {
        this.main.data_controller.params.reverse_output = val
        if (this.board) {
            this.board.setOutput(4, val)
        }
    }

    setCoolantPumpOutput(val: boolean) {
        this.main.data_controller.params.cool_pump_output = val
        if (this.board) {
            this.board.setOutput(8, val)
        }
    }

    setBrakeLightOutput(val: boolean) {
        this.main.data_controller.params.brake_light_out = val
        if (this.board) {
            this.board.setOutput(7, val)
        }
    }

    setTSActiveRelay(val: boolean) {
        this.main.data_controller.params.ts_active_out = val
        if (this.board) {
            this.board.setOutput(3, val)
        }
    }
}