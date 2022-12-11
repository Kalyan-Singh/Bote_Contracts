import { ethers } from 'hardhat';
import fetch from 'node-fetch';

async function main() {
    const worldIDAddress = await fetch('https://developer.worldcoin.org/api/v1/contracts')
        .then(res => res.json() as Promise<{ key: string; value: string }[]>)
        .then(res => res.find(({ key }) => key === 'staging.semaphore.wld.eth').value);
    console.log(worldIDAddress);

    const _actionId="wid_staging_978b5b53ab94088150a6fc64d5ee3912";
    const ContractFactory = await ethers.getContractFactory('BoteOriginal')
    const boteOriginal = await ContractFactory.deploy(worldIDAddress,_actionId);
    await boteOriginal.deployed()

    console.log('Contract deployed to:', boteOriginal.address)
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
