import {BinaryValue, Gpio} from "onoff"

export type RelayOutputPort = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export default class RelayBoard {

    private output_1: Gpio
    private output_2: Gpio
    private output_3: Gpio | null = null
    private output_4: Gpio
    private output_5: Gpio
    private output_6: Gpio
    private output_7: Gpio
    private output_8: Gpio

    constructor() {
        this.output_1 = new Gpio(535, 'out');
        this.output_2 = new Gpio(536, 'out');
        //this.output_3 = new Gpio(519, 'out'); // Does not Work!!
        this.output_4 = new Gpio(528, 'out'); // Reverse Direction
        this.output_5 = new Gpio(532, 'out'); // Foot Switch
        this.output_6 = new Gpio(529, 'out'); // Forward direction
        this.output_7 = new Gpio(539, 'out'); // Brake Light
        this.output_8 = new Gpio(534, 'out'); // BCM = 22

        for (let i: RelayOutputPort = 1; i <= 8; i++) {
            this.setOutput(<RelayOutputPort>i, false)
        }
    }

    setOutput(port: RelayOutputPort, state: Boolean) {
        const out: number = 1 - <number><unknown>state
        switch (port) {
            case 1:
                this.output_1.writeSync(<BinaryValue>out)
                break;
            case 2:
                this.output_2.writeSync(<BinaryValue>out)
                break;
            case 3:
                //this.output_3.writeSync(<BinaryValue> out)
                break;
            case 4:
                this.output_4.writeSync(<BinaryValue>out)
                break;
            case 5:
                this.output_5.writeSync(<BinaryValue>out)
                break;
            case 6:
                this.output_6.writeSync(<BinaryValue>out)
                break;
            case 7:
                this.output_7.writeSync(<BinaryValue>out)
                break;
            case 8:
                this.output_8.writeSync(<BinaryValue>out)
                break;
        }
    }
}