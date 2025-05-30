import ADS1115 from "../libs/ads1115_lib/ADS1115.js";
import VCUCoMcu from "../libs/vcu_co_mcu/vcu_co_mcu.js";
import Main from "../main.js";
import {MavModeFlag, MavState} from "mavlink-mappings/dist/lib/minimal.js";
import {common} from "node-mavlink";
import ParamsHandler from "../libs/params_handler.js";
import {InfluxDB, Point, QueryApi, WriteApi} from "@influxdata/influxdb-client";
import {map_range} from "../libs/helper_functions.js";
import {DrivingMode, DrivingModeMessage} from "mavlink-lib/typescript/lfs.js";
import {GpsFixType} from "mavlink-mappings/dist/lib/common.js";
import LSM6DS032 from "../libs/LSM6DS032/LSM6DS032.js";
import SystemInfo, {SystemInfoData} from "../libs/system_info/system_info.js";
import GPSDriver, {GGAQuality} from "../libs/gps/gps_driver.js";
import INA260 from "../libs/ina260/ina260.js";
import CanDriver from "../libs/can_driver.js";
import {exec} from "node:child_process";
import {encode} from "@msgpack/msgpack";
import {deflateRawSync} from "node:zlib";
import ValueEstimator from "../libs/value_estimator";
import {TractionSystemMode} from "./traction_system_controller";

export const INT16_MAX = 2 ** 15 - 1
export const INT32_MAX = 2 ** 31 - 1

export default class DataController extends ParamsHandler {

    ads: ADS1115 | null = null
    co_mcu: VCUCoMcu | null = null
    gps: GPSDriver | null = null
    imu: LSM6DS032 | null = null
    ina: INA260 | null = null
    system_info: SystemInfo
    can_driver: CanDriver | null = null

    inlfuxdb_write_client: WriteApi
    inlfuxdb_query_client: QueryApi
    measurement_name: string

    readonly FREQ_TO_VELOCITY_CONST = Math.PI * 2 / 24

    last_imu_update: number = 0
    previous_imu_lon_speed: number = 0

    last_ina_current_update: number = 0
    previous_ina_current: number = 0
    last_ina_power_update: number = 0
    previous_ina_power: number = 0

    history_points_cache: Point[] = []

    gps_time_set = false

    stop_sending_logging_data = false

    voc_estimator = new ValueEstimator()

    constructor(private main: Main) {
        super({
            g_constant: 9.82,
            system_state: MavState.UNINIT as MavState,
            system_mode: 0,
            ts_mode: TractionSystemMode.NORMAL as TractionSystemMode,
            driving_mode: DrivingMode.NEUTRAL as DrivingMode,
            throttle_raw: 0,
            throttle_input: 0,
            throttle_output: 0,
            throttle_raw_max: 255,
            throttle_raw_min: 0,
            throttle_max_val: 1,
            throttle_dz: 0,
            throttle_max_rev: 0.3,
            brake_raw: 0,
            brake_input: 0,
            brake_output: 0,
            brake_raw_max: 255,
            brake_raw_min: 0,
            brake_max_val: 1,
            brake_dz: 0,
            brake_light_act: 0.05,
            foot_switch_act: 0.05,
            data_fetch_time: 10,
            front_wheel_rad: 0.250,
            rear_wheel_rad: 0.250,
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
            gps_time: 0,
            gps_speed: 0,
            gps_longitude: 0,
            gps_latitude: 0,
            gps_num_sats: 0,
            gps_altitude: 0,
            gps_mode: common.GpsFixType.NO_GPS as common.GpsFixType,
            gps_hdop: 0,
            gps_vdop: 0,
            gps_heading: 0,
            red_led_output: false,
            green_led_output: false,
            blue_led_output: false,
            fs_output: false,
            forward_switch: false,
            reverse_switch: false,
            cool_pump_output: false,
            brake_light_out: false,
            cool_pump_start: false,
            ts_active_out: false,
            lv_bdi: 1,
            lv_max_energy: 3.45 * 55 * 4,
            lv_cons_cap: 0,
            lv_max_cap: 50,
            lv_cons_energy: 0,
            lv_max_voltage: 3.45 * 4,
            lv_cur_voltage: 0,
            lv_max_amp: 15,
            lv_cur_amp: 0,
            lv_cur_temp: 0,
            lv_cur_power: 0,
            hv_bdi: 1,
            hv_cons_cali: 1,
            hv_max_energy: 5018, //3.45 * 55 * 32,
            hv_max_cap: 55,
            hv_cons_cap: 0,
            hv_cons_energy: 0,
            hv_max_voltage: 3.45 * 32,
            hv_cur_voltage: 0,
            hv_max_amp: 650,
            hv_cur_amp: 0,
            hv_cur_temp: 0,
            acc_lon_raw: 0,
            acc_lat_raw: 0,
            acc_ver_raw: 0,
            gyro_lon_raw: 0,
            gyro_lat_raw: 0,
            gyro_ver_raw: 0,
            acc_lon: 0,
            acc_lat: 0,
            acc_ver: 0,
            gyro_lon: 0,
            gyro_lat: 0,
            gyro_ver: 0,
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
            board_temp: 0,
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
                min: -70000,
                max: 70000
            },
            gps_speed: {
                min: 0,
                max: 150
            },
            gps_num_sats: {
                min: 0,
                max: 100
            },
            gps_altitude: {
                min: -2000,
                max: 2000
            },
            gps_hdop: {
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
                min: -700,
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
            this.ina = new INA260()
            //this.can_driver = new CanDriver()
        }

        const inlfuxdb = new InfluxDB({
            url: process.env.DOCKER_INFLUXDB_URL || "",
            token: process.env.DOCKER_INFLUXDB_TOKEN || ""
        })

        this.measurement_name = "drive_" + new Date(Date.now()).toISOString()

        this.inlfuxdb_write_client = inlfuxdb.getWriteApi(process.env.DOCKER_INFLUXDB_INIT_ORG || "", process.env.DOCKER_INFLUXDB_INIT_BUCKET || "", 'ms')
        this.inlfuxdb_query_client = inlfuxdb.getQueryApi(process.env.DOCKER_INFLUXDB_INIT_ORG || "")
    }

    async init() {
        this.on("error", (err) => {
            this.main.logs_controller.error("Error with data:", err)
        })
        this.on("warning", (warning) => {
            this.main.logs_controller.warning(warning.msg)
        })

        setInterval(() => {
            if (this.history_points_cache.length) {
                this.inlfuxdb_write_client.writePoints(this.history_points_cache)
                this.inlfuxdb_write_client.flush()
                this.history_points_cache = []
            }
        }, 100)

        this.on("change", ({param, value, timestamp}) => {
            if (this.main.isInSystemState(MavState.ACTIVE) && !this.main.isInSystemMode(MavModeFlag.TEST_ENABLED)) {
                let point = new Point(this.measurement_name)
                    .tag('type', 'param')
                    .timestamp(timestamp)
                if (typeof value == "string") {
                    point.stringField(param, value)
                } else if (typeof value == "number") {
                    point.floatField(param, value)
                } else if (typeof value == "boolean") {
                    point.booleanField(param, value)
                }
                this.history_points_cache.push(point)
            }
        })

        if (this.imu && !this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
            this.imu.on("error", (err) => this.main.logs_controller.error("IMU Error:", err))
            this.imu.on("data", (data) => {
                this.params.imu_temp = data[0]
                this.params.acc_lat_raw = data[1]
                this.params.acc_lon_raw = data[2]
                this.params.acc_ver_raw = data[3]
                this.params.gyro_lat_raw = data[4]
                this.params.gyro_lon_raw = data[5]
                this.params.gyro_ver_raw = data[6]

                const current_time = this.main.uptime
                if (this.last_imu_update > 0) {
                    this.params.imu_lon_speed += (current_time - this.last_imu_update) * (this.previous_imu_lon_speed + this.params.acc_lon) / (1000 * 2)
                    this.previous_imu_lon_speed = this.params.acc_lon
                    this.calculateVehicleSpeed()
                }
                this.last_imu_update = current_time
            })

            this.imu.startPoll(50)
        }

        if (this.co_mcu) {
            this.co_mcu.on("error", (err) => this.main.logs_controller.error("CoMCU Error:", err))

            this.co_mcu.on("analog_sensors", (data: number[]) => {
                this.params.throttle_raw = data[0]
                this.params.brake_raw = data[1]
                this.params.steering_raw = data[2]
                this.params.board_temp = (data[3] - 100) / 10

                const throttle_normalized = map_range(this.params.throttle_raw, this.params.throttle_raw_min, this.params.throttle_raw_max, 0, 1)
                this.params.throttle_input = map_range(Math.max(throttle_normalized, this.main.data_controller.params.throttle_dz), this.main.data_controller.params.throttle_dz, 1, 0, 1)
                const brake_normalized = map_range(this.params.brake_raw, this.params.brake_raw_min, this.params.brake_raw_max, 0, 1)
                this.params.brake_input = map_range(Math.max(brake_normalized, this.main.data_controller.params.brake_dz), this.main.data_controller.params.brake_dz, 1, 0, 1)
            })

            this.co_mcu.on("ts_active", (ts_active) => {
                if (this.params.system_state == MavState.STANDBY && ts_active == 1) {
                    this.main.setSystemState(MavState.ACTIVE)
                } else if (this.params.system_state == MavState.ACTIVE && ts_active == 0) {
                    this.main.setSystemState(MavState.STANDBY)
                    if (this.params.ts_active_out) {
                        this.main.traction_system_controller.onUnexpectedTSShutdown()
                    }
                }
            })

            this.co_mcu.on("ind_sensors", (data) => {
                [this.params.ind_3_raw_freq, this.params.ind_2_raw_freq, this.params.ind_1_raw_freq] = data
                this.params.fl_wheel_speed = this.params.ind_1_raw_freq * this.params.front_wheel_rad * this.FREQ_TO_VELOCITY_CONST
                this.params.fr_wheel_speed = this.params.ind_2_raw_freq * this.params.front_wheel_rad * this.FREQ_TO_VELOCITY_CONST
                this.params.rear_axle_speed = this.params.ind_3_raw_freq * this.params.rear_wheel_rad * this.FREQ_TO_VELOCITY_CONST
                this.calculateVehicleSpeed()
            })

            this.co_mcu.startPoll(40, 200)
        }

        if (this.gps) {
            this.gps.on("data", (data: any) => {
                if (data.hasOwnProperty("time")) {
                    this.params.gps_time = (data.time as Date).getTime()
                    if (!this.gps_time_set) {
                        exec('date -s "' + data.time.toString() + '"', async (error) => {
                            if (error) throw error;
                            await this.main.logs_controller.info("Set system time to " + data.time.toLocaleString());
                            this.gps_time_set = true
                        });
                    }
                }
                if (data.hasOwnProperty("lat") && data.hasOwnProperty("lon")) {
                    this.params.gps_latitude = data.lat
                    this.params.gps_longitude = data.lon
                    this.params.gps_heading = this.gps!.heading
                }
                if (data.hasOwnProperty("alt")) {
                    this.params.gps_altitude = data.alt
                }
                if (data.hasOwnProperty("speed")) {
                    this.params.gps_speed = data.speed / 3.6
                }
                if (data.hasOwnProperty("satsActive")) {
                    this.params.gps_num_sats = data.satsActive.length
                }
                if (data.hasOwnProperty("satellites")) {
                    this.params.gps_num_sats = data.satellites
                }
                if (data.hasOwnProperty("hdop")) {
                    this.params.gps_hdop = data.hdop
                }
                if (data.hasOwnProperty("vdop")) {
                    this.params.gps_vdop = data.vdop
                }
                if (data.hasOwnProperty("quality")) {
                    switch (data.quality as GGAQuality) {
                        case GGAQuality["dgps-fix"]: {
                            this.params.gps_mode = GpsFixType.DGPS
                            break;
                        }
                        case GGAQuality["fix"]: {
                            this.params.gps_mode = GpsFixType.GPS_FIX_TYPE_2D_FIX
                            break;
                        }
                        case GGAQuality["pps-fix"]: {
                            this.params.gps_mode = GpsFixType.PPP
                            break;
                        }
                        case GGAQuality["rtk"]: {
                            this.params.gps_mode = GpsFixType.RTK_FIXED
                            break;
                        }
                        case GGAQuality["rtk-float"]: {
                            this.params.gps_mode = GpsFixType.RTK_FLOAT
                            break;
                        }
                        case GGAQuality["estimated"]: {
                            this.params.gps_mode = GpsFixType.STATIC
                            break;
                        }
                        case GGAQuality["manual"]: {
                            this.params.gps_mode = GpsFixType.STATIC
                            break;
                        }
                        case GGAQuality["simulated"]: {
                            this.params.gps_mode = GpsFixType.STATIC
                            break;
                        }
                    }

                }
                if (data.hasOwnProperty("fix")) {
                    this.params.gps_mode = data.fix == "3D" ? GpsFixType.GPS_FIX_TYPE_3D_FIX : GpsFixType.GPS_FIX_TYPE_2D_FIX
                }
                if (data.hasOwnProperty("heading")) {
                    this.params.gps_heading = data.heading
                }

                if (this.params.gps_mode == GpsFixType.NO_GPS) {
                    this.params.gps_mode = GpsFixType.NO_FIX
                }
            })
        }

        if (this.ina && !this.main.isInSystemMode(MavModeFlag.HIL_ENABLED)) {
            this.ina.on("error", (err) => this.main.logs_controller.error("INA260 Error:", err))
            this.ina.on("data", (data) => {
                this.params.lv_cur_power = data[0] / 1000
                this.params.lv_cur_voltage = data[1]
                this.params.lv_cur_amp = data[2] / 1000
            })

            this.addParamListener(["lv_cons_energy", "lv_max_energy"], () => {
                this.params.lv_bdi = (this.params.lv_max_energy - this.params.lv_cons_energy) / this.params.lv_max_energy
            })

            this.ina.startPoll(100)
        }

        if (this.can_driver) {
            this.can_driver.on("error", (err) => this.main.logs_controller.error("CAN Error:", err))
            this.can_driver.on("data", (raw_data: number[]) => {
                this.params.hv_cur_temp = Math.max(raw_data[1], raw_data[2], raw_data[3]) / 100
                this.params.hv_cur_amp = raw_data[0] / 10
            })
        }

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

        this.addParamListener(["hv_cons_cap", "hv_max_cap"], () => {
            this.params.hv_bdi = Math.max(0, (this.params.hv_max_cap - this.params.hv_cons_cap) / this.params.hv_max_cap)
            this.saveParam("hv_bdi", this.params.hv_bdi)
        })

        this.addParamListener("hv_cur_amp", ({value}) => {
            this.params.hv_cur_voltage = this.voc_estimator.getClosestY(1 - this.params.hv_bdi) * 32 - value * 0.7e-3
            this.params.vehicle_power = this.params.hv_cur_amp * this.params.hv_cur_voltage
        })

        this.addParamListener("hv_cons_cap", () => {
            this.saveParam("hv_cons_cap", this.params.hv_cons_cap)
        })

        this.addParamListener("hv_cons_energy", () => {
            this.saveParam("hv_cons_energy", this.params.hv_cons_energy)
        })

        /*this.addParamListener(["hv_cons_energy", "hv_max_energy"], () => {
            this.params.hv_bdi = Math.max(0, (this.params.hv_max_energy - this.params.hv_cons_energy) / this.params.hv_max_energy)
        })*/

        this.addParamListener("lv_cur_amp", () => {
            const current_time = this.main.uptime
            if (this.last_ina_current_update > 0) {
                const energy_change = (current_time - this.last_ina_current_update) * (this.previous_ina_current + this.params.lv_cur_amp) / (1000 * 2)
                if (energy_change < 0.1*this.params.lv_max_energy / 13.2) {
                    this.params.lv_cons_cap += energy_change
                    this.previous_ina_current = this.params.lv_cur_amp
                    this.saveParam("lv_cons_cap", this.params.lv_cons_cap)
                } else {
                    this.main.logs_controller.debug("Got to high consume for cap, (dE: " + energy_change + " amp: " + this.params.lv_cur_amp + " dt: " + (current_time - this.last_ina_current_update))
                }

            }
            this.last_ina_current_update = current_time
        })

        this.addParamListener("lv_cur_power", () => {
            const current_time = this.main.uptime
            if (this.last_ina_power_update > 0) {
                const energy_change = (current_time - this.last_ina_power_update) * (this.previous_ina_power + this.params.lv_cur_power) / (1000 * 2 * 3600)
                if (energy_change < 0.1*this.params.lv_cur_power) {
                    this.params.lv_cons_energy += energy_change
                    this.previous_ina_power = this.params.lv_cur_power
                    this.saveParam("lv_cons_energy", this.params.lv_cons_energy)
                } else {
                    this.main.logs_controller.debug("Got to high consume for power, (dE: " + energy_change + " Watt: " + this.params.lv_cur_power + " dt: " + (current_time - this.last_ina_current_update))
                }
            }
            this.last_ina_power_update = current_time
        })

        this.addParamListener(["lv_cons_energy", "lv_max_energy"], () => {
            this.params.lv_bdi = Math.max(0, (this.params.lv_max_energy - this.params.lv_cons_energy) / this.params.lv_max_energy)
        })

        this.addParamListener("driving_mode", () => {
            const msg = new DrivingModeMessage()
            msg.drivingMode = this.params.driving_mode
            this.main.mavlink_controller.send(msg)
        })

        await this.main.logs_controller.debug("Data controller initialized!")
    }

    calculateVehicleSpeed() {
        let speeds_used = 0
        const speeds = [
            this.params.fl_wheel_speed * 3.6,
            this.params.fr_wheel_speed * 3.6,
            this.params.rear_axle_speed * 3.6,
            this.params.gps_speed * 3.6
            //this.params.imu_lon_speed*3.6 // TODO re-add this after calibrating
        ]

        let vehicle_speed = 0
        for (let i = 0; i < speeds.length; i++) {
            if (!isNaN(speeds[i]) && speeds[i] > 1) {
                vehicle_speed += speeds[i]
                speeds_used++
            }
        }

        this.params.vehicle_speed = Math.round(vehicle_speed / (speeds_used == 0 ? 1 : speeds_used))
    }


    async startSendingDataLog(log_id: number, sys_id: number, comp_id: number) {
        this.stop_sending_logging_data = false
        const measurements = await this.getMeasurements()
        const drive = measurements[log_id]
        await this.main.logs_controller.info("Got request for transferring data log: " + drive)
        const fluxQuery = `from(bucket:"${process.env.DOCKER_INFLUXDB_INIT_BUCKET}") |> range(start: 0) |> filter(fn: (r) => r._measurement == "${drive}")`
        const data_obj: { [propName: string]: { t: string | number, v: number }[] } = {}
        for await (const {values, tableMeta} of this.inlfuxdb_query_client.iterateRows(fluxQuery)) {
            const o = tableMeta.toObject(values)
            if (!data_obj.hasOwnProperty(o._field)) {
                data_obj[o._field] = []
            } else {
                data_obj[o._field].push({t: o._time, v: o._value})
            }
        }

        let lowest_time = 1e20
        for (const key of Object.keys(data_obj)) {
            data_obj[key] = data_obj[key].map(({t, v}: { t: string | number, v: number }) => {
                const time = new Date(t).getTime()
                if (time < lowest_time) {
                    lowest_time = time
                }
                return {t: time, v}
            })
        }

        for (const key of Object.keys(data_obj)) {
            data_obj[key] = data_obj[key].map(({t, v}: { t: string | number, v: number }) => {
                return {t: <number>t - lowest_time, v}
            })
        }

        const chunk_size = 200
        const data_buffer = deflateRawSync(encode(data_obj))
        const chunks = Math.ceil(data_buffer.byteLength / chunk_size)

        await this.main.logs_controller.info("Start transferring log..")

        const init_msg = new common.LoggingDataAcked()
        init_msg.data = Array.from(encode({packets: chunks}))
        init_msg.targetSystem = sys_id
        init_msg.targetComponent = comp_id
        init_msg.length = init_msg.data.length
        init_msg.firstMessageOffset = 0
        init_msg.sequence = 0
        const response = await this.main.mavlink_controller.sendWithAnswer(init_msg, common.LoggingAck, 5000)
        if (response != null) {
            let succeeded = true
            this.main.mavlink_controller.shouldSendMavMessages(false)
            let tri = 0
            for (let i = 0; i <= chunks;) {
                if (this.stop_sending_logging_data) {
                    await this.main.logs_controller.info("Stopped sending logging data.")
                    succeeded = false
                    break;
                }
                let data_chunk: Uint8Array = new Uint8Array()
                const msg = new common.LoggingDataAcked()
                if (i < chunks) {
                    data_chunk = new Uint8Array(data_buffer.subarray(i * chunk_size, (i + 1) * chunk_size))
                }
                msg.data = i < chunks ? Array.from(data_chunk) : []
                msg.targetSystem = sys_id
                msg.targetComponent = comp_id
                msg.length = i < chunks ? data_chunk.length : 0
                msg.firstMessageOffset = i % 255
                msg.sequence = i % 255
                const response = <common.LoggingDataAcked>await this.main.mavlink_controller.sendWithAnswer(msg, common.LoggingAck, 2000)

                if (response) {
                    if (response.sequence == i % 255) {
                        i++
                        tri = 0
                    } else {
                        tri++
                    }
                } else if (tri >= 5) {
                    await this.main.logs_controller.error("Sending data logg failed after 5 tries.")
                    succeeded = false
                    break;
                } else {
                    tri++
                }
            }
            if (succeeded) {
                await this.main.logs_controller.info("Transferred data log succeeded!")
            }
        } else {
            await this.main.logs_controller.error("Failed to send info packet, skipping the rest.")
        }

        this.main.mavlink_controller.shouldSendMavMessages(true)
    }

    private async getMeasurements(): Promise<string[]> {
        const measurements: string[] = []
        const fluxQuery = `
            import "influxdata/influxdb/schema"
            schema.measurements(bucket:"${process.env.DOCKER_INFLUXDB_INIT_BUCKET}")
        `
        for await (const {values, tableMeta} of this.inlfuxdb_query_client.iterateRows(fluxQuery)) {
            const o = tableMeta.toObject(values)
            measurements.push(o._value)
        }
        return measurements
    }

    async sendLoggingDataList(sys_id: number, comp_id: number) {
        await this.main.logs_controller.info("Got request for transferring data log list.")

        return await this.main.mavlink_controller.send(await this.getMeasurements().then((measurements) => measurements
            .map((measurement, index) => {
                const msg = new common.LoggingData()
                msg.data = Array.from(encode({
                    id: index,
                    date: new Date(measurement.substring(measurement.indexOf("_") + 1)).getTime()
                }))
                msg.sequence = index
                msg.length = msg.data.length
                msg.firstMessageOffset = index
                msg.targetSystem = sys_id
                msg.targetComponent = comp_id
                return msg
            })))
    }

    async stopSendingDataLog() {
        await this.main.logs_controller.info("Stopping..")
        this.stop_sending_logging_data = true
    }
}
