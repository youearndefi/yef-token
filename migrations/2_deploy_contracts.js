const YEFToken = artifacts.require('YEFToken');
const YEFTokenPresale = artifacts.require('YEFTokenPresale');

module.exports = async function(deployer){
    const multisigAddress = '0x2ECbb5E2ecef7118c64ffac7fD6f33012DDd6394';
    let presaleContractInstance;
    deployer.deploy(YEFTokenPresale, multisigAddress).then(() => YEFTokenPresale.deployed()).then(presaleInstance => {
        presaleContractInstance = presaleInstance;
        return deployer.deploy(YEFToken, presaleInstance.address)
    }).then(tokenInstance => {
        return presaleContractInstance.setTokenToSale(tokenInstance.address);
    })
}
