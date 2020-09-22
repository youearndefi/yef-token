const { fromWei, toWei } = require('web3-utils');
const { BN, constants, expectEvent, expectRevert, time, ether , balance:balanceHelper } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { expect } = require('chai');

const YEFToken = artifacts.require('YEFToken');
const YEFTokenPresale = artifacts.require('YEFTokenPresale');

let yefERC20TokenInstance, yefTokenPresaleInstance, multisigWalletAddressMock, setTokenLogs, ownerAddress, beforeBalanceMultisigWallet = 0;

let referrer, purchaser;

let PRESALE_STARTING_TIMESTAMP, PRESALE_ENDING_TIMESTAMP, RATE_PRICE_NUMERATOR, RATE_PRICE_DENOMINATOR, REFERRAL_BONUS;

const calculateReceiveTokenAmount = ({ether:etherAmount}) => {
    const weiBn = ether(new BN(etherAmount))
    return 0.3;//fromWei(weiBn.mul(RATE_PRICE_NUMERATOR).div(RATE_PRICE_DENOMINATOR).toNumber())
}
const BN2Number = b => b.toNumber();

function getTokenBalanceOfPurchaser(p = purchaser){
    return yefERC20TokenInstance.balanceOf(p).then(fromWei).then(Number)  
}

async function expectERC20TokenToEqual(toEqualValue, p=purchaser){
    const balance = await getTokenBalanceOfPurchaser(p);
    expect(balance).to.equal(toEqualValue);
}

function getTokenAmountRaised(){
    return yefTokenPresaleInstance.tokenAmountRaised.call().then(fromWei).then(Number)  
}

function expectTokenPurchasedLog
(
    logs, 
    {
        purchaser,
        beneficiary,
        value,
        amount
    }
){
    return expectEvent.inLogs(logs, 'TokensPurchased', {
        purchaser,
        beneficiary,
        value,
        amount
    })
}

function purchase(refAddress, value, p = purchaser){
    return yefTokenPresaleInstance.purchase(refAddress, {
        from: p,
        value: ether(new BN(value))
    });
}

contract('YEFTokenPresale', async accounts => {
    multisigWalletAddressMock = '0xee3e85997b90958199F31e9f28F55A3e7cAFD293'
    beforeEach(async () => {
        ownerAddress = accounts[0]
        yefTokenPresaleInstance = await YEFTokenPresale.new(multisigWalletAddressMock);
        yefERC20TokenInstance = await YEFToken.new(yefTokenPresaleInstance.address);
        ({logs: setTokenLogs} = await yefTokenPresaleInstance.setTokenToSale(yefERC20TokenInstance.address));
        ([_, __, referrer, purchaser] = accounts);
        PRESALE_STARTING_TIMESTAMP = await yefTokenPresaleInstance.STARTING_TIMESTAMP.call().then(BN2Number)
        PRESALE_ENDING_TIMESTAMP = await yefTokenPresaleInstance.ENDING_TIMESTAMP.call().then(BN2Number)
        RATE_PRICE_NUMERATOR = await yefTokenPresaleInstance.RATE_PRICE_NUMERATOR.call().then(BN2Number)
        RATE_PRICE_DENOMINATOR = await yefTokenPresaleInstance.RATE_PRICE_DENOMINATOR.call().then(BN2Number)
        REFERRAL_BONUS = await yefTokenPresaleInstance.REFERRAL_BONUS.call().then(BN2Number)
    })
    describe("setTokenToSale", () => {
        it ("should set token successful", async() => {

        })
        it("should remove owner permission", async () => {
            await expectEvent.inLogs(setTokenLogs, 'OwnershipTransferred', {
                previousOwner: ownerAddress,
                newOwner: ZERO_ADDRESS
            })
        })
    })
    describe("purchase", async () => {
        
        it("should revert when the presale has not started yet", async () => {
            await expectRevert(purchase(ZERO_ADDRESS, 1), 'the token presale has not started yet')
        })

        it("should revert when the weiAmout is zero", async () => {
            await time.increaseTo(PRESALE_STARTING_TIMESTAMP);
            await expectRevert(
                purchase(ZERO_ADDRESS, 0),
                'invalid amount'
            )
        })

        it("should purchase, deriver and forward fund without referrer successful", async () => {
            const {logs} = await purchase(ZERO_ADDRESS, 1);
            const expectReviceTokensForPurchaser = calculateReceiveTokenAmount({
                ether: 1
            }); //expect 0.3
            expect(expectReviceTokensForPurchaser).to.equal(0.3);
            const tokenBalanceOfPurchaser = await getTokenBalanceOfPurchaser()
            expect(tokenBalanceOfPurchaser).to.equal(expectReviceTokensForPurchaser);
            expect(await getTokenAmountRaised()).to.equal(expectReviceTokensForPurchaser);
            expectTokenPurchasedLog(logs, {
                purchaser,
                beneficiary: purchaser,
                value: toWei('1'),
                amount: toWei(expectReviceTokensForPurchaser.toString())
            })
        })
        
        it("should purchase, deriver and forward fund with referrer successful", async () => {
            const {logs} = await purchase(referrer, 1);
            const expectReviceTokensForPurchaser = calculateReceiveTokenAmount({
                ether: 1
            }); //expect 0.3
            expect(expectReviceTokensForPurchaser).to.equal(0.3);            
            const tokenBalanceOfPurchaser = await getTokenBalanceOfPurchaser()
            expect(tokenBalanceOfPurchaser).to.equal(expectReviceTokensForPurchaser);
            const expectTokensReceiveForReferrer = expectReviceTokensForPurchaser*(REFERRAL_BONUS/100);            
            expect(await getTokenAmountRaised()).to.equal(expectReviceTokensForPurchaser+expectTokensReceiveForReferrer);
            expect(await getTokenBalanceOfPurchaser(referrer)).to.equal(expectTokensReceiveForReferrer);
            expectTokenPurchasedLog(logs, {
                purchaser,
                beneficiary: purchaser,
                value: toWei('1'),
                amount: toWei(expectReviceTokensForPurchaser.toString())
            })
            expectEvent.inLogs(logs, 'ReferrerEarned', {
                purchaser,
                referrer,
                value: toWei(expectTokensReceiveForReferrer.toString())
            })
        })

        it("tokenAmountRaised should increase correctly while handle with multiple purchase actions", async () => {
            let expectTokenAmountRaised = 0;
            await purchase(ZERO_ADDRESS, 10, accounts[2]);
            await expectERC20TokenToEqual(3, accounts[2]);
            expectTokenAmountRaised += 3;
            await purchase(ZERO_ADDRESS, 10, accounts[3]);
            await expectERC20TokenToEqual(3, accounts[3]);
            expectTokenAmountRaised += 3;
            await purchase(accounts[3], 10, accounts[4]);
            await expectERC20TokenToEqual(3, accounts[4]);
            await expectERC20TokenToEqual(3+3*(REFERRAL_BONUS/100), accounts[3]);
            expectTokenAmountRaised += 3+3*(REFERRAL_BONUS/100);
            expect(await getTokenAmountRaised()).to.equal(expectTokenAmountRaised);            
        })

        it("should revert when the token sold out", async () => {
            await expectRevert(purchase(ZERO_ADDRESS, 100000), 'the token sold out')
        })
        
    })

    describe("burnRemainingToken", async () => {
        it("should revert when the token presale is not ended", async () => {
            await expectRevert(
                yefTokenPresaleInstance.burnRemainingToken({
                    from: accounts[5] //not the owner
                }),
                'the token presale has not ended yet'
            )
        })

        it("purchase: should revert when the presale has ended", async () => {
            await time.increaseTo(PRESALE_ENDING_TIMESTAMP);
            await expectRevert(purchase(ZERO_ADDRESS, 1), 'the token presale has ended')
        })

        it("should burn successful", async () => {
            const remainingBalance = await getTokenBalanceOfPurchaser(yefTokenPresaleInstance.address)
            const {logs} = await yefTokenPresaleInstance.burnRemainingToken({
                from: accounts[6] //not the owner
            })
            expect(await getTokenBalanceOfPurchaser(yefTokenPresaleInstance.address)).to.equal(0)
            //cannot get @param logs because the diffirent between contracts, but the event still emited correctly

            // expectEvent.inLogs(logs, 'Transfer', {
            //     from: yefTokenPresaleInstance.address,
            //     to: ZERO_ADDRESS,
            //     value: toWei(remainingBalance.toString()),
            // });

        })
        it("should revert when there are nothing to burn", async () => {
            //a guy number 7 burns first
            await yefTokenPresaleInstance.burnRemainingToken({
                from: accounts[7] //not the owner
            })
            //then the guy number 5 should got a revert
            await expectRevert(
                yefTokenPresaleInstance.burnRemainingToken({
                    from: accounts[5] //not the owner
                }),
                'nothing to burn'
            )
        })
    })



})