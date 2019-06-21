import { call, put, select, takeLatest } from 'redux-saga/effects'

// Initialization Functions
import { initializeWeb3, getNetworkId } from '../web3/web3Saga'
import { getAccounts } from '../accounts/accountsSaga'
import { getAccountBalances } from '../accountBalances/accountBalancesSaga'

import { NETWORK_MISMATCH } from '../web3/constants'

function * initializeDrizzle (action) {
  try {
    const options = action.options
    const web3Options = options.web3
    const drizzle = action.drizzle

    // Initialize web3 and get the current network ID.
    var web3 = yield call(initializeWeb3, { options: web3Options })
    drizzle.web3 = web3

    // Client may opt out of connecting their account to the dapp Guard against
    // further web3 interaction, and note web3 will be undefined
    //
    if (web3) {
      const networkId = yield call(getNetworkId, { web3 })

      // Get initial accounts list and balances.
      yield call(getAccounts, { web3 })
      yield call(getAccountBalances, { web3 })

      const networkWhitelist = options.networkWhitelist
      // const networkWhitelist = [4]
      // TODO: specify ganache id: 5777
      if (networkWhitelist.length && !networkWhitelist.includes(networkId)) {
        console.log(networkId)
        yield put({ type: NETWORK_MISMATCH }) // add in params?
        }

      // Instantiate contracts passed through via options.
      for (var i = 0; i < options.contracts.length; i++) {
        var contractConfig = options.contracts[i]
        var events = []
        var contractName = contractConfig.contractName

        if (contractName in options.events) {
          events = options.events[contractName]
        }

        yield call([drizzle, drizzle.addContract], contractConfig, events)
      }

      const syncAlways = options.syncAlways

      // Protect server-side environments by ensuring ethereum access is
      // guarded by isMetaMask which should only be in browser environment.
      //
      if (web3.currentProvider.isMetaMask && !window.ethereum) {
        // Using old MetaMask, attempt block polling.
        const interval = options.polls.blocks
        yield put({ type: 'BLOCKS_POLLING', drizzle, interval, web3, syncAlways })
      } else {
        // Not using old MetaMask, attempt subscription block listening.
        yield put({ type: 'BLOCKS_LISTENING', drizzle, web3, syncAlways })
      }

      // Accounts Polling
      if ('accounts' in options.polls) {
        yield put({
          type: 'ACCOUNTS_POLLING',
          interval: options.polls.accounts,
          web3
        })
      }
    }
  } catch (error) {
    yield put({ type: 'DRIZZLE_FAILED', error })

    console.error('Error initializing Drizzle:')
    console.error(error)

    return
  }

  yield put({ type: 'DRIZZLE_INITIALIZED' })
}

function * drizzleStatusSaga () {
  yield takeLatest('DRIZZLE_INITIALIZING', initializeDrizzle)
}

export default drizzleStatusSaga
