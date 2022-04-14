/*
 * Hearth Beat Helper
 * Author: Thorleif Jacobsen
 */

const EventEmitter = require('events')
const ADS1015 = require('ads1015')


const PGA = 4.096 // Power Gain Amplifier  - 4.096 on gain 1
const MAX_RANGE = 2048 // ADS1015 - 2^(12-1) // 12bit, -2048 to 2047


module.exports = class AnalogDigitalConverter {

  constructor(options) {

    this.eventEmitter = new EventEmitter()

    this.busNo = 1
    this.address = 0x48
    this.provider = 'i2c-bus'

    ADS1015.open(this.busNo, this.address, this.provider)
    .then(ads1015 => {
      this.sensor = ads1015
      this.sensor.gain = 1
      this.readSensorData()
      this.eventEmitter.emit('init')
    })


    this.voltageDividor = (options && options.hasOwnProperty('voltageDividor')) ? options.voltageDividor : 0.176029962546816;    
    this.currentMultiplier = (options && options.hasOwnProperty('currentMultiplier')) ? options.currentMultiplier : 35.714285714285715;    

    // Default values = 0
    this.a2 = 0
    this.a0 = 0
    this.a1 = 0

    // Auto Read Sensor 
    this.autoRead = true
    this.readInterval = 500
    this.lastRead = null
    this.lastMAH = null
    this.accumulatedCurrent = 0
  }


  on(event, callback) {

    this.eventEmitter.on(event, callback)
  }


  async readSensorData() {

    this.a0 = (await this.sensor.measure('0+GND') / MAX_RANGE * PGA)
    this.a1 = (await this.sensor.measure('1+GND') / MAX_RANGE * PGA)
    this.a2 = (await this.sensor.measure('2+GND') / MAX_RANGE * PGA)
    
    this.calculateAccumulatedMah()

    this.eventEmitter.emit('read')

    if (this.autoRead) setTimeout(() => { this.readSensorData() }, this.readInterval)
  }

  getCurrent() {
    return this.a0 * this.currentMultiplier
  }

  getCurrentInMah() {
    return this.getCurrent() * 1000
  }

  getVoltage() {
    return this.a1 / this.voltageDividor
  }

  getLeak() {
    return this.a2 > 1
  }

  getAccumulatedMah() {
    return Math.round(this.accumulatedCurrent)
  }

  calculateAccumulatedMah() {
    if(this.lastRead == null) {
      this.lastRead = Date.now()
      this.lastMAH = this.getCurrentInMah()
      this.accumulatedCurrent = 0
      return
    }

    const duration = Date.now() - this.lastRead
    this.accumulatedCurrent += (this.lastMAH / 3600000) * duration
    this.lastRead = Date.now()
    this.lastMAH = this.getCurrentInMah()
  }

  

}