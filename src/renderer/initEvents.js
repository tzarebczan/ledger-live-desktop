// @flow

import { ipcRenderer } from 'electron' // eslint-disable-line import/no-extraneous-dependencies
import objectPath from 'object-path'

import { devicesUpdate, deviceAdd, deviceRemove } from 'actions/devices'
import { setUpdateStatus } from 'reducers/update'

type MsgPayload = {
  type: string,
  data: *,
}

// wait a bit before launching update check
const CHECK_UPDATE_TIMEOUT = 3e3

function send(channel: string, msgType: string, data: *) {
  ipcRenderer.send(channel, {
    type: msgType,
    data,
  })
}

export default (store: Object) => {
  const handlers = {
    devices: {
      update: devices => {
        store.dispatch(devicesUpdate(devices))
        if (devices.length) {
          send('usb', 'wallet.infos.request', {
            path: devices[0].path,
            wallet: 'btc',
          })
        }
      },
    },
    device: {
      add: device => store.dispatch(deviceAdd(device)),
      remove: device => store.dispatch(deviceRemove(device)),
    },
    wallet: {
      infos: {
        success: ({ path, publicKey }) => {
          console.log({ path, publicKey })
        },
        fail: ({ path, err }) => {
          console.log({ path, err })
        },
      },
    },
    updater: {
      checking: () => store.dispatch(setUpdateStatus('checking')),
      updateAvailable: info => store.dispatch(setUpdateStatus('available', info)),
      updateNotAvailable: () => store.dispatch(setUpdateStatus('unavailable')),
      error: err => store.dispatch(setUpdateStatus('error', err)),
      downloadProgress: progress => store.dispatch(setUpdateStatus('progress', progress)),
      downloaded: () => store.dispatch(setUpdateStatus('downloaded')),
    },
  }

  ipcRenderer.on('msg', (e: *, payload: MsgPayload) => {
    const { type, data } = payload

    const handler = objectPath.get(handlers, type)
    if (!handler) {
      return
    }

    handler(data)
  })

  // First time, we get all devices
  send('usb', 'devices.all')

  // Start detection when we plug/unplug devices
  send('usb', 'devices.listen')

  if (__PROD__) {
    // Start check of eventual updates
    setTimeout(() => send('msg', 'updater.init'), CHECK_UPDATE_TIMEOUT)
  }
}