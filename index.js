'use strict'
const StellarSdk = require('stellar-sdk')
const ora = require('ora')
const chalk = require('chalk')

const LIVE_HORIZON = "https://horizon.stellar.org/"
const TEST_HORIZON = "https://horizon-testnet.stellar.org/"

function getSvr(horizon) {
  return new StellarSdk.Server(TEST_HORIZON)
}

function getNetworkPassphrase() {
  return StellarSdk.Networks.TESTNET
  //return StellarSdk.Networks.PUBLIC
}

const BUYER = {
  publicKey: 'GALXJYPEJHBNLZFZNO24ZZMDFF5EPVF55WZJ3FXMKYWYMFQS5PJT7QXQ',
  secretKey: 'SAQCRZGSUATRLDZXBJF5OBQ2S372SZQ3KQQMQPOTLD77B7FL264BHVGB',
}

const SELLER = {
  publicKey: 'GAR4BELV25G3URDRIBYKIJMKO3642GITTDJVB53ZOGBELGMHTVJJXMZS',
  secretKey: 'SB24Z32AUHXASC4ZMXXQ2FBLBQLYEVLKSPMWWJKRRKS7Z5TS5NVKP5HQ',
}

const TSS = {
  url: 'https://tss-wrangler.everlife.workers.dev/',
  hash: 'aaa4d948605fa72d00b3902483ed6670698c5c1c8f05a190237da609a87290a2',
  signer: 'GCYTED6QWSGDNLQ2RBXDVYSKCOUB2BC6DLKGAU5QPNONMVN47ABUN6WE',
}

/*    understand/
 * main entry point into our program
 *
 *    way/
 * 1. Buyer creates claimable balance and gives to seller
 * 2. Seller generates NFT
 * 3. Seller executes smart contract on TSS
 * 4. Seller signs and executes the smart contract transferring
 * ownership to buyer
 */
async function main() {

  const claim = await buyer_claimable_balance()
  const nft = await seller_create_nft(claim)
  const xdr = await seller_xcute_tss(nft, claim)

  await seller_sign_and_deliver(xdr)
}

async function buyer_claimable_balance() {
  const spinner = ora(`${chalk.yellow('buyer:')} Creating claimable balance`).start()
  await dummy()
  spinner.succeed(`${chalk.yellow('buyer:')} Claimable balance created! 💸`)
}

async function seller_create_nft(claim) {
  const spinner = ora(`${chalk.green('seller:')} Creating NFT`).start()
  await dummy()
  spinner.succeed(`${chalk.green('seller:')} NFT created! ✨`)
}

async function seller_xcute_tss(nft, claim) {
  const spinner = ora(`${chalk.green('seller:')} Execute Smart Contract on TSS`).start()
  await dummy()
  spinner.succeed(`${chalk.green('seller:')} Received Smart Contract Envelope ✉️`)
}

async function seller_sign_and_deliver(xdr) {
  const spinner = ora(`${chalk.green('seller:')} Sign and Deliver NFT via Smart Contract`).start()
  await dummy()
  spinner.succeed(`${chalk.green('seller:')} NFT Delivered! 😇`)
}


function dummy() {
  return new Promise(resolve => setTimeout(resolve, 2000))
}

main().then(() => 1).catch(e => console.error(e))
