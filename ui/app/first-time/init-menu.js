const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter
const Component = require('react').Component
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const Mascot = require('../components/mascot')
const actions = require('../actions')
const Tooltip = require('../components/tooltip')
const getCaretCoordinates = require('textarea-caret')

module.exports = connect(mapStateToProps)(InitializeMenuScreen)

inherits(InitializeMenuScreen, Component)
function InitializeMenuScreen () {
  Component.call(this)
  this.animationEventEmitter = new EventEmitter()
  // localhost
  this.sdkdConfig = {
    sdkdHost: 'http://localhost:3000',
    sdkdWsHost: 'ws://localhost:3000',
    apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhcGlfY2xpZW50X2lkIjoiNGVkNTNiYTAtNTRjYy00M2QwLTk4MDgtZGZiMTY2ZDhhMmI4IiwiY3JlYXRlZF9hdCI6MTUwNzIzNjQ4OH0.z4_h_4iTCYyv0OMCqe6RE0XEvM_DIagTR3lfRbQt74w'
  }


}

function mapStateToProps (state) {
  return {
    // state from plugin
    currentView: state.appState.currentView,
    warning: state.appState.warning,
  }
}

InitializeMenuScreen.prototype.render = function () {
  var state = this.props

  switch (state.currentView.name) {

    default:
      return this.renderMenu(state)

  }
}

// InitializeMenuScreen.prototype.componentDidMount = function(){
//   document.getElementById('password-box').focus()
// }

InitializeMenuScreen.prototype.renderMenu = function (state) {
  return (

    h('.initialize-screen.flex-column.flex-center.flex-grow', [

      h(Mascot, {
        animationEventEmitter: this.animationEventEmitter,
      }),

      h('h1', {
        style: {
          fontSize: '1.3em',
          textTransform: 'uppercase',
          color: '#7F8082',
          marginBottom: 10,
        },
      }, 'MetaMask'),


      h('div', [
        h('h3', {
          style: {
            fontSize: '0.8em',
            color: '#7F8082',
            display: 'inline',
          },
        }, 'Pair with your Amble Wallet'),

        h(Tooltip, {
          title: 'Your Amble Wallet is your mobile wallet that can be used via MetaMask',
        }, [
          h('i.fa.fa-question-circle.pointer', {
            style: {
              fontSize: '18px',
              position: 'relative',
              color: 'rgb(247, 134, 28)',
              top: '2px',
              marginLeft: '4px',
            },
          }),
        ]),
      ]),

      h('span.in-progress-notification', state.warning),

      // email
      h('input.large-input.letter-spacey', {
        type: 'text',
        id: 'email-box',
        placeholder: 'Amble Wallet Email',
        onInput: this.inputChanged.bind(this),
        onKeyPress: this.pairOnEnter.bind(this),
        style: {
          width: 260,
          marginTop: 12,
        },
      }),

      h('button.primary', {
        onClick: this.pairWithAmbleWallet.bind(this),
        style: {
          margin: 12,
        },
      }, 'Submit'),

      h('.flex-row.flex-center.flex-grow', [
        h('p.pointer', {
          onClick: function () { window.open('https://www.sdkd.co', '_blank') },
          style: {
            fontSize: '0.8em',
            color: 'rgb(247, 134, 28)',
            textDecoration: 'underline',
          },
        }, 'Get Amble Wallet'),
      ]),

    ])
  )
}

InitializeMenuScreen.prototype.pairOnEnter = function (event) {
  console.log('pairOnEnter')
  if (event.key === 'Enter') {
    event.preventDefault()
    this.pairWithAmbleWallet()
  }
}

InitializeMenuScreen.prototype.componentDidMount = function () {
  document.getElementById('email-box').focus()
}

InitializeMenuScreen.prototype.showRestoreVault = function () {
  this.props.dispatch(actions.showRestoreVault())
}

InitializeMenuScreen.prototype.createNewVaultAndKeychain = function () {
  console.log('createNewVaultAndKeychain')
  var passwordBox = document.getElementById('password-box')
  var password = passwordBox.value
  var passwordConfirmBox = document.getElementById('password-box-confirm')
  var passwordConfirm = passwordConfirmBox.value

  if (password.length < 8) {
    this.warning = 'password not long enough'
    this.props.dispatch(actions.displayWarning(this.warning))
    return
  }
  if (password !== passwordConfirm) {
    this.warning = 'passwords don\'t match'
    this.props.dispatch(actions.displayWarning(this.warning))
    return
  }

  this.props.dispatch(actions.createNewVaultAndKeychain(password))
}

InitializeMenuScreen.prototype.pairWithAmbleWallet = function () {
  console.log('pairWithAmbleWallet')
  let email = document.getElementById('email-box').value

  // ask server to authorize usage of this wallet
  let wsUri = this.sdkdConfig.sdkdWsHost + '/cable'
  let websocket = new WebSocket(wsUri)
  let ts = Date.now()
  let identifier = {
    channel: 'RemotePairingChannel',
    email: email
  }
  websocket.onopen = (evt) => {
    console.log(evt)
    console.log("CONNECTED")

    // subscribe
    let msg = {
      command: "subscribe",
      identifier: JSON.stringify(identifier)
    }
    websocket.send(JSON.stringify(msg))
  }
  websocket.onclose = (evt) => { console.log(evt) }
  websocket.onerror = (evt) => { console.log(evt) }
  websocket.onmessage = (evt) => {
    let data = JSON.parse(evt.data)
    if (data.type === 'ping') {
      return // ignore pings
    }
    console.log(evt)

    // if subscription confirmation, then send signing request
    // "{"identifier":"{\"channel\":\"RemotePairingChannel\",\"email\":\"cvcassano@gmail.com\"}","type":"confirm_subscription"}"
    if (data.type === 'confirm_subscription') {
      // send remote pairing request
      let data = {
        action: 'authorize_remote_signing',
        request_ts: ts
      }
      let msg = {
        command: 'message',
        identifier: JSON.stringify(identifier),
        data: JSON.stringify(data)
      }
      websocket.send(JSON.stringify(msg))
      return
    }

    if (!data.message) {
      return
    }

    let pairingRequest = data.message.remote_pairing_request
    console.log('pairing request: ' + JSON.stringify(pairingRequest))
    console.log('ts: ' + ts)
    if (pairingRequest && pairingRequest.request_ts === ts.toString()) {
      console.log('authorization or rejection is included')
      websocket.close()
      if (pairingRequest.status === 'approved') {
        // save jwt
        console.log('approved!')
        window.localStorage.setItem('sdkd_jwt', pairingRequest.jwt)
        window.localStorage.setItem('sdkd_user_id', pairingRequest.user_id)
        this.props.dispatch(actions.createNewVaultAndKeychain(email))
      } else {
        console.log('rejected!')
        alert('Amble rejected your pairing request')
      }
    }
  }
}

InitializeMenuScreen.prototype.inputChanged = function (event) {
  // tell mascot to look at page action
  var element = event.target
  var boundingRect = element.getBoundingClientRect()
  var coordinates = getCaretCoordinates(element, element.selectionEnd)
  this.animationEventEmitter.emit('point', {
    x: boundingRect.left + coordinates.left - element.scrollLeft,
    y: boundingRect.top + coordinates.top - element.scrollTop,
  })
}
