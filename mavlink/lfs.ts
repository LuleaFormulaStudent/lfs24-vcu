import {MavLinkData} from "mavlink-mappings"
import {MavLinkPacketField} from "mavlink-mappings/dist/lib/mavlink.js"
import {uint8_t, float, MavLinkPacketRegistry} from "node-mavlink"

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
 * Describes the current driving mode
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

export const REGISTRY: MavLinkPacketRegistry = {
  50000: ThrottleData,
  50001: BrakeData,
  50002: DrivingModeMessage,
  50003: VehicleData,
}
