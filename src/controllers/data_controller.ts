import ADS1115 from "../../libs/ads1115_lib/ADS1115.js";
import VCUCoMcu from "../../libs/vcu_co_mcu/vcu_co_mcu.js";
import Main from "../../main.js";
import GPSDriver from "../../libs/gps/gps_driver.js";
import {MavModeFlag, MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {common} from "node-mavlink";
import ParamsHandler from "../params_handler.js";
import {InfluxDB, Point, WriteApi} from "@influxdata/influxdb-client";
import {map_range} from "../helper_functions.js";
import {DrivingMode} from "../../mavlink/lfs.js";
import {GpsFixType} from "mavlink-mappings/dist/lib/common.js";
import LSM6DS032 from "../../libs/LSM6DS032/LSM6DS032.js";
import SystemInfo, {SystemInfoData} from "../../libs/system_info/system_info";

export const INT16_MAX = 2 ** 15 - 1
export const INT32_MAX = 2 ** 31 - 1

export default class DataController extends ParamsHandler {

    ads: ADS1115
    co_mcu: VCUCoMcu
    gps: GPSDriver
    imu: LSM6DS032
    system_info: SystemInfo

    inlfuxdb_client: WriteApi
    measurement_name: string

    readonly FREQ_TO_VELOCITY_CONST = Math.PI * 2 / 24

    last_imu_update: number = 0
    previous_imu_lon_speed: number = 0

    constructor(private main: Main) {
        super({
            g_constant: 9.82,
            system_state: MavState.UNINIT as MavState,
            system_mode: 0,
            driving_mode: DrivingMode.NEUTRAL as DrivingMode,
            throttle_raw: 0,
            throttle_input: 0,
            throttle_output: 0,
            throttle_raw_max: 255,
            throttle_raw_min: 0,
            throttle_max_val: 0.5,
            brake_raw: 0,
            brake_input: 0,
            brake_output: 0,
            brake_raw_max: 255,
            brake_raw_min: 0,
            brake_light_act: 0.05,
            foot_switch_act: 0.05,
            data_fetch_time: 10,
            front_wheel_rad: 0.201,
            rear_wheel_rad: 0.201,
            ind_1_raw_freq: 0,
            ind_2_raw_freq: 0,
            ind_3_raw_freq: 0,
            fl_wheel_speed: 0,
            fr_wheel_speed: 0,
            rear_axle_speed: 0,
            steering_raw: 0,
            vehicle_speed: 0,
            vehicle_power: 0,
            vehicle_heading: 0,
            vehicle_steering: 0,
            gps_speed: 0,
            gps_longitude: 0,
            gps_latitude: 0,
            gps_num_sats: 0,
            gps_altitude: 0,
            gps_mode: common.GpsFixType.NO_GPS as common.GpsFixType,
            gps_horiz_dil: 0,
            dt_K_I: 0.22,
            dt_K_V: 0.026,
            red_led_output: false,
            green_led_output: false,
            blue_led_output: false,
            fs_output: false,
            forward_switch: false,
            reverse_switch: false,
            cool_pump_output: false,
            brake_light_out: false,
            cool_pump_start: false,
            lv_bdi: 1,
            lv_max_energy: 3.45 * 55 * 4,
            lv_cons_cap: 0,
            lv_cons_energy: 0,
            lv_max_voltage: 3.45 * 4,
            lv_cur_voltage: 14,
            lv_max_amp: 15,
            lv_cur_amp: 14,
            lv_cur_temp: 20,
            hv_bdi: 1,
            hv_max_energy: 5018, //3.45 * 55 * 32,
            hv_cons_cap: 0,
            hv_cons_energy: 0,
            hv_max_voltage: 3.45 * 32,
            hv_cur_voltage: 107,
            hv_max_amp: 650,
            hv_cur_amp: 0,
            hv_cur_temp: 20,
            acc_lon: 0,
            acc_lat: 0,
            acc_z: 0,
            gyro_lon: 0,
            gyro_lat: 0,
            gyro_z: 0,
            imu_temp: 0,
            imu_lon_speed: 0,
            ts_torque: 0,
            ts_rpm: 0,
            ts_temp: 0,
            radio_rssi: 0,
            radio_remrssi: 0,
            radio_txbuf: 0,
            radio_noise: 0,
            radio_remnoise: 0,
            radio_rxerrors: 0,
            radio_fixed: 0,
            computer_type: 0,
            cpu_cores: 0,
            cpu_temp: 0,
            gpu_cores: 0,
            board_temp: INT16_MAX,
            ram_usage: 0,
            ram_total: 0,
            storage_type: 0,
            storage_usage: 0,
            storage_total: 0
        }, {
            throttle_raw: {
                min: 0,
                max: 255
            },
            throttle_input: {
                min: 0,
                max: 1
            },
            throttle_output: {
                min: 0,
                max: 1
            },
            throttle_max_val: {
                min: 0,
                max: 1
            },
            brake_raw: {
                min: 0,
                max: 255
            },
            brake_input: {
                min: 0,
                max: 1
            },
            brake_output: {
                min: 0,
                max: 1
            },
            brake_light_act: {
                min: 0,
                max: 1
            },
            foot_switch_act: {
                min: 0,
                max: 1
            },
            data_fetch_time: {
                min: 1,
                max: 100
            },
            ind_1_raw_freq: {
                min: 0,
                max: 700
            },
            ind_2_raw_freq: {
                min: 0,
                max: 700
            },
            ind_3_raw_freq: {
                min: 0,
                max: 700
            },
            vehicle_speed: {
                min: 0,
                max: 150
            },
            vehicle_power: {
                min: 0,
                max: 70000
            },
            gps_speed: {
                min: 0,
                max: 150
            },
            gps_num_sats: {
                min: 0,
                max: 15
            },
            gps_altitude: {
                min: -200,
                max: 2000
            },
            gps_horiz_dil: {
                min: 0
            },
            lv_bdi: {
                min: 0,
                max: 1
            },
            lv_max_energy: {
                min: 0
            },
            lv_cons_energy: {
                min: 0
            },
            lv_max_voltage: {
                min: 0
            },
            lv_max_amp: {
                min: 0
            },
            hv_bdi: {
                min: 0,
                max: 1
            },
            hv_max_energy: {
                min: 0
            },
            hv_cons_energy: {
                min: 0
            },
            hv_cur_voltage: {
                min: 0,
                max: 130
            },
            hv_max_voltage: {
                min: 0
            },
            hv_cur_amp: {
                min: 0,
                max: 700
            },
            hv_max_amp: {
                min: 0
            }
        })

        this.system_info = new SystemInfo()

        if (this.main.in_production) {
            this.gps = new GPSDriver()
            this.co_mcu = new VCUCoMcu()
            //this.ads = new ADS1115()
            this.imu = new LSM6DS032()
        }

        const inlfuxdb = new InfluxDB({
            url: process.env.DOCKER_INFLUXDB_URL,
            token: process.env.DOCKER_INFLUXDB_TOKEN
        })

        this.measurement_name = "drive_" + new Date(Date.now()).toISOString()

        this.inlfuxdb_client = inlfuxdb.getWriteApi(process.env.DOCKER_INFLUXDB_INIT_ORG, process.env.DOCKER_INFLUXDB_INIT_BUCKET, 'us')
        this.main.logs_controller.debug("Data controller constructors initialized!")
    }

    async init() {
        await this.main.logs_controller.info("Initializing data controller..")
        this.on("error", (err) => {
            this.main.logs_controller.error("Error with data:", err)
        })

        this.on("change", ({param, value}) => {
            if (this.main.data_controller.params.system_state == MavState.ACTIVE) {
                let point = new Point(this.measurement_name)
                    .tag('type', 'param')
                    .timestamp("")
                if (typeof value == "string") {
                    point.stringField(param, value)
                } else if (typeof value == "number") {
                    point.floatField(param, value)
                } else if (typeof value == "boolean") {
                    point.booleanField(param, value)
                }
                this.inlfuxdb_client.writePoints([point])
                this.inlfuxdb_client.flush()
            }
        })

        this.co_mcu.on("error", (err) => this.main.logs_controller.error("CoMCU Error:", err))
        this.imu.on("error", (err) => this.main.logs_controller.error("IMU Error:", err))
        this.imu.on("data", (data) => {
            this.params.imu_temp = data[0]
            this.params.acc_lat = data[1]
            this.params.acc_lon = data[2]
            this.params.acc_z = data[3]
            this.params.gyro_lat = data[4]
            this.params.gyro_lon = data[5]
            this.params.gyro_z = data[6]

            const current_time = this.main.uptime
            if (this.last_imu_update > 0) {
                this.params.imu_lon_speed += (current_time - this.last_imu_update) * (this.previous_imu_lon_speed + this.params.acc_lon) / (1000 * 2)
                this.previous_imu_lon_speed = this.params.acc_lon
                this.calculateVehicleSpeed()
            }
            this.last_imu_update = current_time
        })

        if (this.main.in_production) {
            if (!this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
                this.imu.startPoll(20)
                this.co_mcu.startPoll(50, 200)
            }
        }

        this.co_mcu.on("analog_sensors", (data: number[]) => {
            let temp_raw = 0
                [this.params.throttle_raw, this.params.brake_raw, this.params.steering_raw, temp_raw] = data
            this.params.board_temp = (temp_raw - 100) / 10
            if (!this.main.isInSystemMode(MavModeFlag.TEST_ENABLED) && !this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
                this.params.throttle_input = map_range(this.params.throttle_raw, this.params.throttle_raw_min, this.params.throttle_raw_max, 0, 1)
                this.params.brake_input = map_range(this.params.brake_raw, this.params.brake_raw_min, this.params.brake_raw_max, 0, 1)
            }
        })

        this.co_mcu.on("ts_active", (ts_active) => {
            this.main.setSystemState(ts_active == 1 ? MavState.ACTIVE : MavState.STANDBY)
        })

        this.co_mcu.on("ind_sensors", (data) => {
            [this.params.ind_1_raw_freq, this.params.ind_2_raw_freq, this.params.ind_2_raw_freq] = data
            this.params.fl_wheel_speed = this.params.ind_1_raw_freq * this.params.front_wheel_rad * this.FREQ_TO_VELOCITY_CONST
            this.params.fr_wheel_speed = this.params.ind_2_raw_freq * this.params.front_wheel_rad * this.FREQ_TO_VELOCITY_CONST
            this.params.rear_axle_speed = this.params.ind_3_raw_freq * this.params.rear_wheel_rad * this.FREQ_TO_VELOCITY_CONST
            this.calculateVehicleSpeed()
        })

        this.gps.on("data", (packet: any) => {
            Object.assign(this.params, packet)
            if (this.params.gps_mode == GpsFixType.NO_GPS) {
                this.params.gps_mode = GpsFixType.NO_FIX
            }
        })

        this.system_info.on("data", (data: SystemInfoData) => {
            this.params.cpu_cores = data.cpu.usage
            this.params.cpu_temp = data.cpu.temp
            this.params.ram_total = data.ram.total
            this.params.ram_usage = data.ram.usage
            this.params.storage_type = data.storage.type
            this.params.storage_usage = data.storage.usage
            this.params.storage_total = data.storage.total
        })

        this.addParamListener("gps_speed", () => {
            this.calculateVehicleSpeed()
        })

        this.addParamListener(["hv_cur_amp", "hv_cur_voltage"], () => {
            this.params.vehicle_power = this.params.hv_cur_amp * this.params.hv_cur_voltage
        })

        this.addParamListener("throttle_output", ({value}) => {
            if (!this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
                this.params.hv_cur_amp = this.params.hv_max_amp * value
            }
        })

        await this.main.logs_controller.info("Done initializing data controller!")
    }

    calculateVehicleSpeed() {
        let vehicle_speed = (this.params.fl_wheel_speed + this.params.fr_wheel_speed + this.params.rear_axle_speed) / 3

        if (this.params.gps_speed > 1) {
            vehicle_speed += this.params.gps_speed * 3.6
            vehicle_speed /= 2
        }

        if (this.params.imu_lon_speed > 1) {
            vehicle_speed += this.params.imu_lon_speed * 3.6
            vehicle_speed /= 2
        }

        this.params.vehicle_speed = Math.round(vehicle_speed)
    }
}