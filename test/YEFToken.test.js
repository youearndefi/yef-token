const { BN, constants, expectEvent, expectRevert, ether } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { expect } = require('chai');

const YEFToken = artifacts.require('YEFToken');
let token, mockPresaleManagement, logs;
const MAX_SUPPLY = ether('15000');
contract('YEFToken', accounts => {
    beforeEach(async function () {
        mockPresaleManagement = accounts[2]
        token = await YEFToken.new(mockPresaleManagement);
    });
    it("Should mint 15,000 token to presale management", async () => {
        const balanceOfPresaleManagement = await token.balanceOf(mockPresaleManagement)
        expect(balanceOfPresaleManagement).to.be.bignumber.equal(MAX_SUPPLY);
    })
    describe('burn', function () {
        describe('when the given amount is not greater than balance of the sender', function () {
          context('for a zero amount', function () {
            shouldBurn(new BN(0));
          });
    
          context('for a non-zero amount', function () {
            shouldBurn(new BN(100));
          });
    
          function shouldBurn (amount) {
            beforeEach(async function () {
              ({ logs: logs } = await token.burn(amount, { from: mockPresaleManagement }));
            });
    
            it('burns the requested amount', async function () {
              expect(await token.balanceOf(mockPresaleManagement)).to.be.bignumber.equal(MAX_SUPPLY.sub(amount));
            });
    
            it('emits a transfer event', async function () {
              expectEvent.inLogs(logs, 'Transfer', {
                from: mockPresaleManagement,
                to: ZERO_ADDRESS,
                value: amount,
              });
            });
          }
        });
    
        describe('when the given amount is greater than the balance of the sender', function () {
          const amount = MAX_SUPPLY.addn(1);
          it('reverts', async function () {
            await expectRevert(token.burn(amount, { from: mockPresaleManagement }),
              'ERC20: burn amount exceeds balance',
            );
          });
        });
    });
})
