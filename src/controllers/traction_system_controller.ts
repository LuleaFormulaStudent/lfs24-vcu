import DS3502 from "../../libs/DS3502/DS3502.js";
import Main from "../../main.js";
import {MavModeFlag, MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {common, sleep, waitFor} from "node-mavlink";
import {MavResult} from "mavlink-mappings/dist/lib/common.js";
import {DrivingMode} from "mavlink-lib/dist/lfs.js";

export default class TractionSystemController {

    private readonly brake_device: DS3502 | null = null
    private readonly throttle_device: DS3502 | null = null

    private motor_test_timeout: any = null
    performing_motor_test = false

    constructor(private main: Main) {
        if (this.main.in_production) {
            this.throttle_device = new DS3502(0x28)
            this.throttle_device.on("error", (err) => this.main.logs_controller.error("Error with Throttle Device (DS3502):", err))
            this.brake_device = new DS3502(0x29)
            this.brake_device.on("error", (err) => this.main.logs_controller.error("Error with Brake Device (DS3502):", err))
        }
    }

    async init() {
        this.main.data_controller.addParamListener("throttle_input", ({value}) => {
            if (!this.main.isInSystemMode(MavModeFlag.TEST_ENABLED)) {
                this.main.data_controller.params.throttle_output = value * this.main.data_controller.params.throttle_max_val
            }
        })

        this.main.data_controller.addParamListener("throttle_output", ({value}) => {
            if (value > this.main.data_controller.params.foot_switch_act && this.main.data_controller.params.system_state == MavState.ACTIVE) {
                this.main.digital_outputs_controller.setFootSwitch(true)
            } else {
                this.main.digital_outputs_controller.setFootSwitch(false)
            }

            if (this.throttle_device && this.main.data_controller.params.system_state == MavState.ACTIVE) {
                this.throttle_device.write(value)
            }
        })

        this.main.data_controller.addParamListener("brake_input", ({value}) => {
            this.main.data_controller.params.brake_output = value*this.main.data_controller.params.brake_max_val
        })

        this.main.data_controller.addParamListener("brake_output", ({value}) => {
            this.main.digital_outputs_controller.setBrakeLightOutput(value > this.main.data_controller.params.brake_light_act)
        })

        await this.main.logs_controller.debug("Traction System controller initialized!")
    }

    async activateTS(): Promise<boolean> {
        try {
            if (this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
                await this.main.logs_controller.warning("Cannot activate traction system when in HIL mode!")
            }

            if (this.main.data_controller.params.system_state != MavState.STANDBY) {
                await this.main.logs_controller.info("System is not in standby mode")
                return false
            }

            /*if (!this.main.isInSystemMode(MavModeFlag.TEST_ENABLED) && this.main.data_controller.params.brake_input < 0.3) {
                await this.main.logs_controller.info("Brakes is not applied!")
                return false
            }*/ // TODO: Reactivate this when testing is done, needs to have a more stable brake signal

            await this.main.logs_controller.info("Trying to activate traction system..")
            this.main.digital_outputs_controller.setTSActiveRelay(true)

            await waitFor(() => this.main.data_controller.params.system_state == MavState.ACTIVE, 5000, 100)

            await this.main.logs_controller.info("Traction system activated!")
            return true
        } catch (e) {
            if (e == "Timeout") {
                this.main.digital_outputs_controller.setTSActiveRelay(false)
                await this.main.logs_controller.error("Traction system did not activate in time!")
            } else {
                await this.main.logs_controller.error("Error occurred ")
            }
            return false
        }
    }

    async deactivateTS(): Promise<boolean> {
        try {
            await this.main.logs_controller.info("Trying to deactivate TS")
            this.main.data_controller.params.throttle_output = 0
            this.main.setDrivingMode(DrivingMode.NEUTRAL)
            await sleep(500)
            this.main.digital_outputs_controller.setTSActiveRelay(false)

            await waitFor(() => this.main.data_controller.params.system_state == MavState.STANDBY, 3000, 100)
            return true
        } catch (e) {
            if (e == "Timeout") {
                await this.main.logs_controller.error("Traction system did not deactivate in time!")
            } else {
                await this.main.logs_controller.error("Error occurred when deactivating TS")
            }
            return false
        }
    }

    async onUnexpectedTSShutdown() {
        await this.main.logs_controller.error("Traction system unexpectedly turned off, probably an error occurred!")
        await this.deactivateTS()
    }

    async doMotorTest(throttle:number, direction: DrivingMode, time: number) {
        await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.IN_PROGRESS, 0)
        await this.main.logs_controller.info("Starting motor test")
        await this.main.logs_controller.info("Testing motor in " + DrivingMode[direction].toLowerCase() + "direction with throttle at " + throttle*100 + "% for " + time/1000 + " s.")
        this.main.setSystemMode(MavModeFlag.TEST_ENABLED, true)
        if (this.main.in_production) {
            if (await this.activateTS()) {
                await this.main.logs_controller.info("Starting test!")
                await sleep(500)
                await this.main.setDrivingMode(direction)
                this.main.data_controller.params.throttle_output = throttle
                this.performing_motor_test = true

                this.motor_test_timeout = setTimeout(async () => {
                    await this.deactivateTS()
                    this.main.setSystemMode(MavModeFlag.TEST_ENABLED, false)
                    await this.main.logs_controller.info("Motor test done!")
                    await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.ACCEPTED, 100)
                    this.performing_motor_test = false
                }, time)
            } else {
                await this.main.logs_controller.info("Could not activate TS, skipping motor test.")
                await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.FAILED, 100)
            }
        } else {
            await this.main.logs_controller.info("Skipping activating TS because of not in production.")
            this.main.data_controller.params.throttle_output = throttle
            this.performing_motor_test = true
            this.motor_test_timeout = setTimeout(async () => {
                this.main.setSystemMode(MavModeFlag.TEST_ENABLED, false)
                await this.main.logs_controller.info("Motor test done!")
                this.main.data_controller.params.throttle_output = 0
                await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.ACCEPTED, 100)
                this.performing_motor_test = false
            }, time)
        }
    }

    async abortMotorTest() {
        if (this.performing_motor_test) {
            await this.main.logs_controller.info("Aborting motor test..")
            if (this.motor_test_timeout) {
                clearTimeout(this.motor_test_timeout)
            }
            if (this.main.in_production) {
                if (await this.deactivateTS()) {
                    this.main.setSystemMode(MavModeFlag.TEST_ENABLED, false)
                    await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.DENIED)
                    await this.main.logs_controller.info("Aborting motor test done!")
                } else {
                    await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.FAILED)
                    await this.main.logs_controller.info("Aborting motor test failed!")
                }
            } else {
                this.main.setSystemMode(MavModeFlag.TEST_ENABLED, false)
                await this.main.mavlink_controller.sendCmdAck(common.MavCmd.DO_MOTOR_TEST, MavResult.DENIED)
                await this.main.logs_controller.info("Aborting motor test done!")
            }
        } else {
            await this.main.logs_controller.info("No motor test is going on..")
        }
    }
}