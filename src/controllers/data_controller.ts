import ADS1115 from "../../libs/ads1115_lib/ADS1115.js";
import VCUCoMcu from "../../libs/vcu_co_mcu/vcu_co_mcu.js";
import Main from "../../main.js";
import {map_range} from "../helper_functions.js";
import GPSDriver from "../../libs/gps/gps_driver.js";
import {MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {common} from "node-mavlink";
import ParamsHandler from "../params_handler.js";
import {InfluxDB, Point, WriteApi} from "@influxdata/influxdb-client";

export enum DrivingMode {
    DRIVING_MODE_NEUTRAL = 0,
    DRIVING_MODE_FORWARD = 1,
    DRIVING_MODE_REVERSE = 2
}

export default class DataController extends ParamsHandler {

    ads: ADS1115
    co_mcu: VCUCoMcu
    gps: GPSDriver

    inlfuxdb_client: WriteApi

    constructor(private main: Main) {
        super({
            g_constant: 9.82,
            c: MavState.BOOT as MavState,
            driving_mode: DrivingMode.DRIVING_MODE_NEUTRAL as DrivingMode,
            throttle_raw_val: 0,
            throttle_input: 0,
            throttle_output: 0,
            throttle_raw_max: 255,
            throttle_raw_min: 21,
            throttle_max_val: 0.5,
            throttle_enable: false,
            brake_raw_val: 0,
            brake_input: 0,
            brake_output: 0,
            brake_raw_max: 255,
            brake_raw_min: 21,
            brake_light_act: 0.1,
            foot_switch_act: 0.1,
            data_fetch_time: 10,
            ind_1_raw_val: 0,
            ind_2_raw_val: 0,
            ind_3_raw_val: 0,
            ind_4_raw_val: 0,
            vehicle_speed: 0,
            vehicle_power: 0,
            vehicle_heading: 0,
            vehicle_steering: 0,
            tsal: false,
            gps_speed: 0,
            gps_longitude: 0,
            gps_latitude: 0,
            gps_num_sats: 0,
            gps_altitude: 0,
            gps_mode: common.GpsFixType.NO_FIX as common.GpsFixType,
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
            ts_torque: 0,
            ts_rpm: 0,
            ts_temp: 0
        }, {
            throttle_raw_val: {
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
            brake_raw_val: {
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
            ind_1_raw_val: {
                min: 0,
                max: 2 ** 16
            },
            ind_2_raw_val: {
                min: 0,
                max: 2 ** 16
            },
            ind_3_raw_val: {
                min: 0,
                max: 2 ** 16
            },
            ind_4_raw_val: {
                min: 0,
                max: 2 ** 16
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
                min: 0,
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

        if (this.main.in_production) {
            this.gps = new GPSDriver()
            this.co_mcu = new VCUCoMcu()
            this.ads = new ADS1115()
        }

        const inlfuxdb = new InfluxDB({
            url: process.env.DOCKER_INFLUXDB_URL,
            token: process.env.DOCKER_INFLUXDB_TOKEN
        })

        this.inlfuxdb_client = inlfuxdb.getWriteApi(process.env.DOCKER_INFLUXDB_INIT_ORG, process.env.DOCKER_INFLUXDB_INIT_BUCKET, 'us')
        this.main.logs_controller.debug("Data controller constructors initialized!")
    }

    async init() {
        await this.main.logs_controller.info("Initializing data controller..")
        this.on("error", (err) => {
            this.main.logs_controller.error("Error with data:", err)
        })

        this.on("change", ({param, value}) => {
            let point = new Point('measurements')
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
        })

        if (this.main.in_production) {
            this.co_mcu.startPoll(20)
        }

        /*this.co_mcu.on("analog_sensors", (data) => {
            [this.params.throttle_raw_val, this.params.brake_raw_val] = data
            this.params.throttle_output = map_range(this.params.throttle_raw_val, this.params.throttle_raw_min, this.params.throttle_raw_max, 0, 1)
            this.params.brake_output = map_range(this.params.brake_raw_val, this.params.brake_raw_min, this.params.brake_raw_max, 0, 1)
        })*/

        this.co_mcu.on("ind_sensors", (data) => {
            [this.params.ind_1_raw_val, this.params.ind_2_raw_val, this.params.ind_3_raw_val, this.params.ind_4_raw_val] = data
        })

        this.co_mcu.on("error", (err) => this.main.logs_controller.error("CoMCU Error:", err))

        this.gps.on("data", (packet: any) => {
            Object.assign(this.params, packet)
        })

        this.addParamListener("gps_speed", ({value}) => {
            this.params.vehicle_speed = Math.round(value * 3.6)
        })

        this.addParamListener(["hv_cur_amp", "hv_cur_voltage"], () => {
            this.params.vehicle_power = this.params.hv_cur_amp * this.params.hv_cur_voltage
        })

        this.addParamListener("throttle_output", ({value}) => {
            if (!this.main.in_sim_mode) {
                this.params.hv_cur_amp = this.params.hv_max_amp * value
            }
        })

        await this.main.logs_controller.info("Done initializing data controller!")
    }

    onSimData(values: number[]) {
        this.params.hv_cur_amp = values[0]
        this.params.hv_cons_energy = values[1]
        this.params.hv_cur_voltage = values[3]
        this.params.hv_temp = values[4] - 273.15
        this.params.hv_bdi = values[5]
        this.params.gps_latitude = values[6]
        this.params.gps_longitude = values[7]
        this.params.vehicle_heading = values[8]
        this.params.gps_altitude = values[9]
        this.params.gps_speed = values[10]
        this.params.acc_lon = values[11]
        this.params.acc_lat = values[12]
        this.params.acc_z = values[13]
        this.params.gyro_lon = values[14]
        this.params.gyro_lat = values[15]
        this.params.gyro_z = values[16]
        this.params.ts_torque = values[17]
        this.params.ts_rpm = values[18]
        this.params.vehicle_steering = values[19]
        this.params.throttle_output = values[20]
        this.params.brake_input = values[21]
    }
}