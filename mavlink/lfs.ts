import {MavLinkData} from "mavlink-mappings"
import {MavLinkPacketField} from "mavlink-mappings/dist/lib/mavlink.js"
import {uint8_t, uint16_t, uint32_t, uint64_t, float, MavLinkPacketRegistry} from "node-mavlink"

/**
 * A enum that is not being used
 */
export enum DrivingMode {
  /**
   * In neutral driving mode
   */
  'NEUTRAL' = 0,

  /**
   * In forward driving mode
   */
  'FORWARD' = 1,

  /**
   * In reverse driving mode
   */
  'REVERSE' = 2,
}

/**
 * Handles throttle data, both raw and parsed.
 */
export class ThrottleData extends MavLinkData {
  static MSG_ID = 50000
  static MSG_NAME = 'THROTTLE_DATA'
  static PAYLOAD_LENGTH = 9
  static MAGIC_NUMBER = 109

  static FIELDS = [
    new MavLinkPacketField('input', 'input', 0, false, 4, 'float', 'percent'),
    new MavLinkPacketField('output', 'output', 4, false, 4, 'float', 'percent'),
    new MavLinkPacketField('raw', 'raw', 8, false, 1, 'uint8_t', ''),
  ]

  constructor() {
    super()
    this.raw = 0
    this.input = 0
    this.output = 0
  }

  /**
   * Raw input value from adc
   */
  raw: uint8_t

  /**
   * Parsed input value
   * Units: percent
   */
  input: float

  /**
   * Calculated output value
   * Units: percent
   */
  output: float
}

/**
 * Handles brake data, both raw and parsed.
 */
export class BrakeData extends MavLinkData {
  static MSG_ID = 50001
  static MSG_NAME = 'BRAKE_DATA'
  static PAYLOAD_LENGTH = 9
  static MAGIC_NUMBER = 36

  static FIELDS = [
    new MavLinkPacketField('input', 'input', 0, false, 4, 'float', 'percent'),
    new MavLinkPacketField('output', 'output', 4, false, 4, 'float', 'percent'),
    new MavLinkPacketField('raw', 'raw', 8, false, 1, 'uint8_t', ''),
  ]

  constructor() {
    super()
    this.raw = 0
    this.input = 0
    this.output = 0
  }

  /**
   * Raw input value from adc
   */
  raw: uint8_t

  /**
   * Parsed input value
   * Units: percent
   */
  input: float

  /**
   * Calculated output value
   * Units: percent
   */
  output: float
}

/**
 * Describes the current driving mode
 */
export class DrivingModeMessage extends MavLinkData {
  static MSG_ID = 50002
  static MSG_NAME = 'DRIVING_MODE_MESSAGE'
  static PAYLOAD_LENGTH = 1
  static MAGIC_NUMBER = 253

  static FIELDS = [
    new MavLinkPacketField('driving_mode', 'drivingMode', 0, false, 1, 'uint8_t', ''),
  ]

  constructor() {
    super()
    this.drivingMode = DrivingMode[Object.keys(DrivingMode)[0]]
  }

  /**
   * Current driving mode
   */
  drivingMode: DrivingMode
}

/**
 * Message with the most common vehicle data.
 */
export class VehicleData extends MavLinkData {
  static MSG_ID = 50003
  static MSG_NAME = 'VEHICLE_DATA'
  static PAYLOAD_LENGTH = 16
  static MAGIC_NUMBER = 211

  static FIELDS = [
    new MavLinkPacketField('power', 'power', 0, false, 4, 'float', 'kW'),
    new MavLinkPacketField('speed', 'speed', 4, false, 4, 'float', 'km/h'),
    new MavLinkPacketField('heading', 'heading', 8, false, 4, 'float', 'degrees'),
    new MavLinkPacketField('steering', 'steering', 12, false, 4, 'float', 'degrees'),
  ]

  constructor() {
    super()
    this.power = 0
    this.speed = 0
    this.heading = 0
    this.steering = 0
  }

  /**
   * The power the vehicle is using
   * Units: kW
   */
  power: float

  /**
   * The total current speed of the vehicle
   * Units: km/h
   */
  speed: float

  /**
   * The current heading the vehicle
   * Units: degrees
   */
  heading: float

  /**
   * The current steering angle
   * Units: degrees
   */
  steering: float
}

/**
 * Information about the coolant pump state and values
 */
export class CoolantPump extends MavLinkData {
  static MSG_ID = 50004
  static MSG_NAME = 'COOLANT_PUMP'
  static PAYLOAD_LENGTH = 14
  static MAGIC_NUMBER = 54

  static FIELDS = [
    new MavLinkPacketField('flow', 'flow', 0, false, 4, 'float', 'l/h'),
    new MavLinkPacketField('pressure', 'pressure', 4, false, 4, 'uint32_t', 'Pa'),
    new MavLinkPacketField('temp_1', 'temp1', 8, false, 2, 'uint16_t', 'cDeg'),
    new MavLinkPacketField('temp_2', 'temp2', 10, false, 2, 'uint16_t', 'cDeg'),
    new MavLinkPacketField('state', 'state', 12, false, 1, 'uint8_t', ''),
    new MavLinkPacketField('startup_state', 'startupState', 13, false, 1, 'uint8_t', ''),
  ]

  constructor() {
    super()
    this.state = 0
    this.startupState = 0
    this.flow = 0
    this.pressure = 0
    this.temp1 = 0
    this.temp2 = 0
  }

  /**
   * Current state of the coolant pump, 0 = Off and 1 = On
   */
  state: uint8_t

  /**
   * Describes if the coolant pump should start on startup or not, 0 = Off and 1 = On
   */
  startupState: uint8_t

  /**
   * The flow in the system, -1 if not used
   * Units: l/h
   */
  flow: float

  /**
   * The absolute pressure in the system
   * Units: Pa
   */
  pressure: uint32_t

  /**
   * Temperature at one point in the system
   * Units: cDeg
   */
  temp1: uint16_t

  /**
   * Temperature at one point in the system
   * Units: cDeg
   */
  temp2: uint16_t
}

/**
 * Hardware status of the onboard computer.
 */
export class ComputerStatus extends MavLinkData {
  static MSG_ID = 50005
  static MSG_NAME = 'COMPUTER_STATUS'
  static PAYLOAD_LENGTH = 31
  static MAGIC_NUMBER = 146

  static FIELDS = [
    new MavLinkPacketField('uptime', 'uptime', 0, false, 4, 'uint32_t', 'ms'),
    new MavLinkPacketField('ram_usage', 'ramUsage', 4, false, 4, 'uint32_t', 'MiB'),
    new MavLinkPacketField('ram_total', 'ramTotal', 8, false, 4, 'uint32_t', 'MiB'),
    new MavLinkPacketField('storage_type', 'storageType', 12, false, 4, 'uint32_t', 'MiB'),
    new MavLinkPacketField('storage_usage', 'storageUsage', 16, false, 4, 'uint32_t', 'MiB'),
    new MavLinkPacketField('storage_total', 'storageTotal', 20, false, 4, 'uint32_t', 'MiB'),
    new MavLinkPacketField('temperature_board', 'temperatureBoard', 24, false, 2, 'uint16_t', 'cDegC'),
    new MavLinkPacketField('temperature_core', 'temperatureCore', 26, false, 2, 'uint16_t', 'cDegC'),
    new MavLinkPacketField('type', 'type', 28, false, 1, 'uint8_t', ''),
    new MavLinkPacketField('cpu_core', 'cpuCore', 29, false, 1, 'uint8_t', ''),
    new MavLinkPacketField('gpu_core', 'gpuCore', 30, false, 1, 'uint8_t', 'cDeg'),
  ]

  constructor() {
    super()
    this.uptime = 0
    this.type = 0
    this.cpuCore = 0
    this.gpuCore = 0
    this.temperatureBoard = 0
    this.temperatureCore = 0
    this.ramUsage = 0
    this.ramTotal = 0
    this.storageType = 0
    this.storageUsage = 0
    this.storageTotal = 0
  }

  /**
   * Describes if the coolant pump should start on startup or not, 0 = Off and 1 = On
   * Units: ms
   */
  uptime: uint32_t

  /**
   * Type of the onboard computer: 0: Mission computer primary, 1: Mission computer backup 1, 2: Mission
   * computer backup 2, 3: Compute node, 4-5: Compute spares, 6-9: Payload computers.
   */
  type: uint8_t

  /**
   * CPU usage on the component in percent (100 - idle). A value of UINT8_MAX implies the field is
   * unused.
   */
  cpuCore: uint8_t

  /**
   * GPU usage on the component in percent (100 - idle). A value of UINT8_MAX implies the field is
   * unused.
   * Units: cDeg
   */
  gpuCore: uint8_t

  /**
   * Temperature of the board. A value of INT16_MAX implies the field is unused.
   * Units: cDegC
   */
  temperatureBoard: uint16_t

  /**
   * Temperature of the CPU core. A value of INT16_MAX implies the field is unused.
   * Units: cDegC
   */
  temperatureCore: uint16_t

  /**
   * Amount of used RAM on the component system. A value of UINT32_MAX implies the field is unused.
   * Units: MiB
   */
  ramUsage: uint32_t

  /**
   * Total amount of RAM on the component system. A value of UINT32_MAX implies the field is unused.
   * Units: MiB
   */
  ramTotal: uint32_t

  /**
   * Storage type: 0: HDD, 1: SSD, 2: EMMC, 3: SD card (non-removable), 4: SD card (removable). A value
   * of UINT32_MAX implies the field is unused.
   * Units: MiB
   */
  storageType: uint32_t

  /**
   * Amount of used storage space on the component system. A value of UINT32_MAX implies the field is
   * unused.
   * Units: MiB
   */
  storageUsage: uint32_t

  /**
   * Total amount of storage space on the component system. A value of UINT32_MAX implies the field is
   * unused.
   * Units: MiB
   */
  storageTotal: uint32_t
}

export const REGISTRY: MavLinkPacketRegistry = {
  50000: ThrottleData,
  50001: BrakeData,
  50002: DrivingModeMessage,
  50003: VehicleData,
  50004: CoolantPump,
  50005: ComputerStatus,
}
