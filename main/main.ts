import StatusLed from "./controllers/status_led.js";
import TractionSystemController from "./controllers/traction_system_controller.js";
import SteeringWheelController from "./controllers/steering_wheel_controller.js";
import DataController from "./controllers/data_controller.js";
import DigitalOutputsController from "./controllers/digital_outputs_controller.js";
import MavlinkController from "./controllers/mavlink_controller.js";
import {MavModeFlag, MavState} from "mavlink-mappings/dist/lib/minimal.js";
import LogsController from "./controllers/logs_controller.js";
import package_info from "./package.json"
import {configDotenv} from "dotenv";
import HILController from "./controllers/hil_controller.js";
import {exec} from "node:child_process";
import AdmZip from "adm-zip";
import fs from "fs";
import CoolantSystemController from "./controllers/coolant_system_controller";

configDotenv()

export default class Main {

    data_controller: DataController
    status_led: StatusLed
    traction_system_controller: TractionSystemController
    steering_wheel_controller: SteeringWheelController
    digital_outputs_controller: DigitalOutputsController
    mavlink_controller: MavlinkController
    logs_controller: LogsController
    hil_controller: HILController
    coolant_system_controller: CoolantSystemController

    in_production: boolean = process.env.NODE_ENV == 'production'
    start_time: number = Date.now()
    version: string = package_info.version

    constructor() {
        this.logs_controller = new LogsController(this)
        this.data_controller = new DataController(this)
        this.digital_outputs_controller = new DigitalOutputsController(this)
        this.status_led = new StatusLed(this)
        this.traction_system_controller = new TractionSystemController(this)
        this.steering_wheel_controller = new SteeringWheelController(this)
        this.mavlink_controller = new MavlinkController(this)
        this.hil_controller = new HILController(this)
        this.coolant_system_controller = new CoolantSystemController(this)
    }

    async init() {
        await this.logs_controller.init()
        await this.logs_controller.info("Starting initialization of system..")
        await this.logs_controller.info("Version: " + this.version)
        await this.setSystemState(MavState.BOOT)

        if (this.in_production) {
            const onExit = async (err: any) => {
                this.digital_outputs_controller.setForwardSwitch(false)
                this.digital_outputs_controller.setReverseSwitch(false)

                if (this.data_controller.params.system_state == MavState.ACTIVE) {
                    await this.traction_system_controller.deactivateTS()
                    this.digital_outputs_controller.setTSActiveRelay(false)
                }

                this.status_led.setGreenLED(false)
                this.status_led.setBlueLED(false)
                if (err) {
                    this.status_led.setRedLED(true)
                    console.error(err)
                }
                await this.logs_controller.info("Exiting..")
            }
            process.on('exit', onExit);
            process.on('SIGINT', onExit);
            process.on('SIGUSR1',onExit);
            process.on('SIGUSR2', onExit);
            process.on('uncaughtException', onExit);

            await this.logs_controller.info("System is in production mode.")
        } else {
            await this.logs_controller.info("System is in development mode.")
            this.setSystemMode(MavModeFlag.HIL_ENABLED, true)
        }

        await this.data_controller.init()
        await this.digital_outputs_controller.init()
        await this.traction_system_controller.init()
        await this.steering_wheel_controller.init()
        await this.hil_controller.init()
        await this.coolant_system_controller.init()
        await this.mavlink_controller.init()

        await this.logs_controller.info("Done initializing system!")
        await this.setSystemState(MavState.STANDBY)
        this.status_led.setBlueLED(false)
        this.status_led.setGreenLED(true)
    }

    async setSystemState(state: MavState) {
        this.data_controller.params.system_state = state
        if (this.mavlink_controller.heartbeat) {
            this.mavlink_controller.heartbeat.systemStatus = this.data_controller.params.system_state
        }
        await this.logs_controller.info("Setting system in " + MavState[state].toLowerCase() + " state.")
    }

    isInSystemState(state: MavState): boolean {
        return this.data_controller.params.system_state == state
    }

    get uptime(): number {
        return Date.now() - this.start_time
    }

    setSystemMode(mode: MavModeFlag, active: boolean) {
        if (active) {
            this.data_controller.params.system_mode |= mode;
        } else {
            this.data_controller.params.system_mode &= ~mode;
        }
    }

    isInSystemMode(mode: MavModeFlag): boolean {
        return (this.data_controller.params.system_mode & mode) != 0
    }

    async handleNewFirmware(file_name: string) {
        try {
            const zip = new AdmZip(file_name)
            const test_result = zip.test()
            if (test_result) {
                await this.logs_controller.info("Testing firmware passed!")
                await this.logs_controller.info("Extracting files..")
                if (fs.existsSync("./source")) {
                    await zip.extractAllToAsync("./source", true)
                } else {
                    await this.logs_controller.error("Source folder does not exists! Skipping extracting")
                }
                await this.logs_controller.info("Done!")
                //const new_package_info = (await import("./package.json", {assert: { type: "json" }})).default
                //console.log(new_package_info)
                //await this.logs_controller.info("New version: " + new_package_info.version)
                await this.logs_controller.info("Rebooting system..")
                exec('sudo /sbin/shutdown -r now');
            } else {
                await this.logs_controller.error("Firmware did not pass testing, maybe it is corrupt")
            }
        } catch (e) {
            console.log(e)
            await this.logs_controller.error("Problem parsing zip, maybe it is corrupt")
        }
    }
}

(new Main().init())

// Fixa Ouput 3 relay board