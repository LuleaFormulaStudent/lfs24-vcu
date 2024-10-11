import EventEmitter from "node:events";
import {LocalStorage} from "node-localstorage";

export default class ParamsHandler extends EventEmitter {

    events: { [propName: string]: EventEmitter } = {}
    params: any = {}

    private storage = new LocalStorage("./data/params/")

    constructor(params = {}, params_settings: {[propName: string]: {min?: number, max?: number}} = {}) {
        super()
        this.params = {
            __this: this,
            __params_settings: params_settings
        }
        for (const param in params) {
            if (param.length > 16) {
                console.error("Warning:", param, "has more than 16 chars in name.")
            }
            Object.defineProperty(this.params, param, {
                set(value) {
                    if (this.__params_settings.hasOwnProperty(param)) {
                        if (this.__params_settings[param].hasOwnProperty("min") && value < this.__params_settings[param].min) {
                            this.__this.emit("warning", {error: "min", msg: "Min value triggered for " + param + "=" + value, param, value, timestamp: Date.now()})
                        } else if (this.__params_settings[param].hasOwnProperty("max") && value > this.__params_settings[param].max) {
                            this.__this.emit("warning", {error: "max", msg: "Max value triggered for " + param + "=" + value, timestamp: Date.now()})
                        } else {
                            this["_" + param] = value
                            if (this.__this.events.hasOwnProperty(param)) {
                                this.__this.events[param].emit("change", ({param, value, timestamp: Date.now()}))
                            }
                            this.__this.emit("change", ({param, value, timestamp: Date.now()}))
                        }
                    } else {
                        this["_" + param] = value
                        if (this.__this.events.hasOwnProperty(param)) {
                            this.__this.events[param].emit("change", ({param, value, timestamp: Date.now()}))
                        }
                        this.__this.emit("change", ({param, value, timestamp: Date.now()}))
                    }
                },
                get(): any {
                    return this["_" + param]
                }
            });
        }
        for (const [key, val] of Object.entries(params)) {
            this.params[key] = this.getParam(key)|| val
        }
    }

    getParam(param: string): null | number | boolean | string {
        if (this.storage.getItem(param) != null) {
            const value: string = this.storage.getItem(param)!
            if (value == "false") {
                return false
            } else if (value == "true") {
                return true
            } else if (!isNaN(parseFloat(value))) {
                return parseFloat(value)
            } else {
                return value
            }
        } else {
            return null
        }
    }

    saveParam(param: string, value: any) {
        this.storage.setItem(param, value)
    }

    getParams() {
        return Object.keys(this.params)
            .filter((v) => !v.startsWith("__"))
            .map((v) => v.substring(1))
    }

    addParamListener(params: string | string[], fun: (...args: any[]) => void): boolean {
        try {
            if (typeof params == "string") {
                if (!this.events.hasOwnProperty(params)) {
                    this.events[params] = new EventEmitter()
                }

                this.events[params].addListener("change", fun)
            } else {
                for (const param of params) {
                    if (!this.events.hasOwnProperty(param)) {
                        this.events[param] = new EventEmitter()
                    }
                    this.events[param].addListener("change", fun)
                }
            }

            return true
        } catch (e) {
            return false
        }
    }

    removeParamListener(param: string, fun: (...args: any[]) => void) {
        if (this.events.hasOwnProperty(param)) {
            this.events[param].removeListener("change", fun)
            return true
        } else {
            return false
        }
    }
}