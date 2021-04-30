'use strict'
const StellarSdk = require('stellar-sdk')
const ora = require('ora')
const chalk = require('chalk')
const req = require('@tpp/req')

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
  publicKey: 'GAMGW7ZESFF2KVGL7EMBBIAXTFAOF3MNI2JBWSPLTGMAKOSVLHDNZMA2',
  url: 'http://tss-wrangler.everlife.workers.dev',
  hash: 'aaa4d948605fa72d00b3902483ed6670698c5c1c8f05a190237da609a87290a2',
  signer: 'GCYTED6QWSGDNLQ2RBXDVYSKCOUB2BC6DLKGAU5QPNONMVN47ABUN6WE',
  salePrice: "420",
  txFunctionFee: "AAAAAgAAAADUjFI6v/HOUlgIpwXUAEtJ25DSImdJR8sJEUHg1oMsqwAAAGQAAphYAAAADAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAA6qk2UhgX6ctALOQJIPtZnBpjFwcjwWhkCN9pgmocpCiAAAAAQAAAAAAAAABAAAAABhrfySRS6VUy/kYEKAXmUDi7Y1GkhtJ65mYBTpVWcbcAAAAAAAAAAABMS0AAAAAAAAAAAHWgyyrAAAAQBL7TW9Q45FNU1Zy/YLSArozCxlMlGk65WddNGSVgqJuosdgcv7+p7rV2jFWBonpJRrh/fFnC3ieKuiOiq8VDAM=",
}

let spinner

/*    understand/
 * main entry point into our program
 *
 *    way/
 * 1. Buyer creates claimable balance and gives to seller
 * 2. Seller generates NFT
 * 3. Seller executes smart contract on TSS
 * 4. Seller signs and executes the smart contract transferring
 * ownership to buyer
 *
 * TODO: note that txFunctionFee needs to be occasionally created as a
 * payment of 1 or 2 XLM to the TSS public key with the memo holding a
 * hash of the function
 */
async function main() {
  try {
    const claim = await buyer_claimable_balance()
    const nft = await seller_create_nft()
    const smartContract = await seller_xcute_tss(nft, claim)

    await seller_sign_and_deliver(smartContract)
  } catch(e) {
    spinner.fail()
    console.error(e)
    if(e.response && e.response.data) console.error(JSON.stringify(e.response.data, 0, 2))
  }
}

/*    way/
 *  create a claimable balance valid for a minute and hand it's id over
 */
async function buyer_claimable_balance() {
  spinner = ora(`${chalk.yellow('buyer:')} Creating claimable balance`).start()

  const server = getSvr()
  const acc = await server.loadAccount(BUYER.publicKey)

  const soon = Math.ceil((Date.now() / 1000) + 60)
  const canClaim = StellarSdk.Claimant.predicateBeforeRelativeTime("60");
  const canReclaim = StellarSdk.Claimant.predicateNot(StellarSdk.Claimant.predicateBeforeAbsoluteTime(soon.toString()))

  const claimableBalanceEntry = StellarSdk.Operation.createClaimableBalance({
    claimants: [
      new StellarSdk.Claimant(TSS.signer, canClaim),
      new StellarSdk.Claimant(BUYER.publicKey, canReclaim)
    ],
    asset: StellarSdk.Asset.native(),
    amount: "420",
  })

  const tx = new StellarSdk.TransactionBuilder(acc, {fee: StellarSdk.BASE_FEE})
    .addOperation(claimableBalanceEntry)
    .setNetworkPassphrase(getNetworkPassphrase())
    .setTimeout(180)
    .build()

  tx.sign(StellarSdk.Keypair.fromSecret(BUYER.secretKey))

  const txResponse = await server.submitTransaction(tx)
  const txResult = StellarSdk.xdr.TransactionResult.fromXDR(txResponse.result_xdr, "base64")
  const results = txResult.result().results()
  const result = results[0].value().createClaimableBalanceResult()
  const claim = result.balanceId().toXDR("hex")

  spinner.succeed(`${chalk.yellow('buyer:')} Claimable balance created! 💸 ${chalk.dim(claim)}`)

  return claim
}

function generate_nft(data) {
  const issuer = StellarSdk.Keypair.fromSecret(SELLER.secretKey)
  const signedObject = create_signed_object_1(issuer, data)
  const hash = StellarSdk.hash(Buffer.from(signedObject, 'utf8'))
  return get_keypair_1(hash)

  function get_keypair_1(hash) {
    return StellarSdk.Keypair.fromRawEd25519Seed(hash)
  }

  function create_signed_object_1(issuerKeys, data) {
    const json = JSON.stringify(data)
    const hash = StellarSdk.hash(Buffer.from(json, 'utf-8'))
    const signature = issuerKeys.sign(hash).toString('base64')
    return JSON.stringify({
      sig: signature,
      meta: data
    })
  }
}

async function seller_create_nft() {
  spinner = ora(`${chalk.green('seller:')} Creating NFT`).start()

  const server = getSvr()
  const acc = await server.loadAccount(SELLER.publicKey)

  const data = {
    id: '&zGY975rpfWToGn5lG9KVj2g3zMAd3n3Nmr9DQQ+ie3A=.sha256',
    name: '@qiqqqKggAr1Mix06/gP2PT1X7TtBGajJ2w3iZIjTvsc=.ed25519' + Math.random(),
    image_url: 'http://149.202.214.34/everlife-ai-artist/WvGlxNnVx.jpg',
  }

  const nft = generate_nft(data)

  await activate_account_1()
  await set_signatories_1()

  spinner.succeed(`${chalk.green('seller:')} NFT created! ✨ ${chalk.dim(nft.publicKey())}`)

  return nft.publicKey()

  function activate_account_1() {
    const op = {
      destination: nft.publicKey(),
      startingBalance: "5",
    }

    const txn = new StellarSdk.TransactionBuilder(acc, { fee: StellarSdk.BASE_FEE, networkPassphrase: getNetworkPassphrase() })
      .addOperation(StellarSdk.Operation.createAccount(op))
      .setTimeout(180)
      .build()

    txn.sign(StellarSdk.Keypair.fromSecret(SELLER.secretKey))

    return server.submitTransaction(txn)
  }

  async function set_signatories_1() {
    const op1 = {
      signer: {
        ed25519PublicKey: TSS.signer,
        weight: 1,
      }
    }
    const op2 = {
      signer: {
        ed25519PublicKey: SELLER.publicKey,
        weight: 1,
      }
    }

    const acc = await server.loadAccount(nft.publicKey())

    const txn = new StellarSdk.TransactionBuilder(acc, { fee: StellarSdk.BASE_FEE, networkPassphrase: getNetworkPassphrase() })
      .addOperation(StellarSdk.Operation.setOptions(op1))
      .addOperation(StellarSdk.Operation.setOptions(op2))
      .setTimeout(180)
      .build()

    txn.sign(nft)

    return server.submitTransaction(txn)
  }
}

/*    way/
 * submit the nft and claim to the TSS to execute the smart contract
 */
async function seller_xcute_tss(nft, claim) {
  spinner = ora(`${chalk.green('seller:')} Execute Smart Contract on TSS`).start()

  const op = {
    nft_buyer: BUYER.publicKey,
    nft_asset: nft,
    nft_seller: SELLER.publicKey,
    claimable_balance_id: claim,
    signer: TSS.signer,
    nft_sale_price: TSS.salePrice,
    txFunctionFee: TSS.txFunctionFee,
  }

  const u = `${TSS.url}/tx-functions/${TSS.hash}`

  const resp = await reqP(u, op)

  spinner.succeed(`${chalk.green('seller:')} Received Smart Contract Envelope ✉️`)

  return resp
}

/*    way/
 * sign and deliver smart contract to claim fee and hand NFT to buyer
 */
async function seller_sign_and_deliver(smartContract) {
  spinner = ora(`${chalk.green('seller:')} Sign and Deliver NFT via Smart Contract`).start()

  const server = getSvr()

  const txn = new StellarSdk.Transaction(smartContract.xdr, getNetworkPassphrase())
  txn.addSignature(smartContract.signer, smartContract.signature)

  await server.submitTransaction(txn)

  spinner.succeed(`${chalk.green('seller:')} NFT Delivered! 😇`)
}


function reqP(url, data) {
  return new Promise((res,rej) => {
    req.post(url, data, (err, resp) => {
      if(err) rej(err)
      else res(resp.body)
    })
  })
}

function dummy() {
  return new Promise(resolve => setTimeout(resolve, 2000))
}

main().then(() => 1).catch(e => console.error(e))
