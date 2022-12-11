import { expect } from 'chai'
import { ethers, network } from 'hardhat'
import { Contract } from 'ethers'
import {
    getProof,
    getRoot,
    prepareWorldID,
    registerIdentity,
    setUpWorldID,
    registerInvalidIdentity,
} from './helpers/InteractsWithWorldID'

const ACTION_ID = 'wid_test_1234'

describe('Contract', function () {
    let Contract: Contract
    let callerAddr: string

    this.beforeAll(async () => {
        await prepareWorldID()
    })

    beforeEach(async () => {
        const [signer] = await ethers.getSigners()
        const worldIDAddress = await setUpWorldID()
        const ContractFactory = await ethers.getContractFactory('Contract')
        Contract = await ContractFactory.deploy(worldIDAddress, ACTION_ID)
        await Contract.deployed()

        callerAddr = await signer.getAddress()
    })

    // it('Accepts and validates calls', async function () {
    //     await registerIdentity()

    //     const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)

    //     const tx = await Contract.verifyAndExecute(
    //         callerAddr,
    //         await getRoot(),
    //         nullifierHash,
    //         proof
    //     )

    //     await tx.wait()

    //     // extra checks here
    // })

    it('Rejects duplicated calls', async function () {
        await registerIdentity()
        const [signer,signer2] = await ethers.getSigners();
        const callerAddr2=await signer2.getAddress();
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted

        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr);

        console.log(nullifierHash);
        await expect(
            Contract.connect(signer).verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
        ).to.not.be.reverted

        const [nullifierHash2, proof2] = await getProof(ACTION_ID, callerAddr2)
        console.log(nullifierHash2);
        // You will see that the same nullifier hash is generated if same identify tries to vote for same poll using different address
        await expect(
            Contract.connect(signer2).verifyAndExecute(callerAddr2, await getRoot(), nullifierHash2, proof2, 1, 'bjp')
        ).to.be.revertedWith('InvalidNullifier')
    })
    it('Rejects calls from non-members', async function () {
        await registerInvalidIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted

        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
        await expect(
            Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
        ).to.be.revertedWith('InvalidProof')

        // extra checks here
    })

    it('Rejects calls if time is over', async function () {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted
        await network.provider.send('evm_increaseTime', [180])
        await network.provider.send('evm_mine')
        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
        await expect(
            Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
        ).to.be.reverted;
    })

    it('Rejects call if starter is not creator', async function () {
        await registerIdentity()
        const [signer, fraud] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(fraud).startPoll(1)).to.be.revertedWith(
            'You do not have the permission to start the poll!'
        )
    })
    it('Rejects calls if poll was started before', async function () {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.be.revertedWith(
            'The poll was started before'
        )
    })
    it('Rejects calls if poll does not exist', async function () {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(2)).to.be.revertedWith(
            'Given poll id does not exist'
        )
    })

    it('Rejects votes if poll hasnt been started', async function () {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(
            Contract.connect(signer).verifyAndExecute(
                callerAddr,
                await getRoot(),
                nullifierHash,
                proof,
                1,
                'bjp'
            )
        ).to.be.reverted;
    })
    it('Rejects votes if no such party exists', async function () {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted
        await expect(
            Contract.connect(signer).verifyAndExecute(
                callerAddr,
                await getRoot(),
                nullifierHash,
                proof,
                1,
                'cong'
            )
        ).to.be.revertedWith('There is no such party')
    })
    // it('Does not show result if poll is yet to end', async function () {
    //     await registerIdentity()
    //     const [signer] = await ethers.getSigners()
    //     await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
    //     await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted
    //     await expect(Contract.connect(signer).showResult(1)).to.be.revertedWith(
    //         'The poll has not ended yet'
    //     )
    // })
    // it('Shows result if the poll has ended', async function () {
    //     await registerIdentity()
    //     const [signer] = await ethers.getSigners()
    //     await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
    //     await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted
    //     const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
    //     await expect(
    //         Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
    //     ).to.not.be.reverted
    //     await network.provider.send('evm_increaseTime', [180])
    //     await network.provider.send('evm_mine')
    //     await expect(Contract.connect(signer).showResult(1)).to.not.be.reverted
    // })
    it('fails to get state if poll does not exist', async () => {
        await expect(Contract.getState(1)).to.be.revertedWith('Given poll id does not exist')
    })
    it('Gets the state of the poll', async () => {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.getState(1)).to.not.be.reverted
    })
    it('Does not get the parties if no such poll', async () => {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.getParties(2)).to.be.reverted
    })
    it('Gets the parties', async () => {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.getParties(1)).to.not.be.reverted
    })
    it('Gets user created polls', async () => {
        await registerIdentity()
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).myPolls()).to.not.be.reverted
    })

    it('Allows user to vote for 2 different polls', async () => {
        await registerIdentity();
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted

        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)

        await expect(
            Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
        ).to.not.be.reverted;

        await expect(Contract.connect(signer).addPoll(3, ['bjp', 'cong'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(2)).to.not.be.reverted
        const [nullifierHash1, proof1] = await getProof(ACTION_ID, callerAddr)

        await expect(
            Contract.connect(signer).verifyAndExecute(
                callerAddr,
                await getRoot(),
                nullifierHash1,
                proof1,
                2,
                'bjp'
            )
        ).to.not.be.reverted;
        console.log(proof);
        console.log(proof1);
        console.log(nullifierHash);
        console.log(nullifierHash1);
    });
    it("Gets the votes and parties",async()=>{
        await registerIdentity();
        const [signer] = await ethers.getSigners()
        await expect(Contract.connect(signer).addPoll(2, ['bjp'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(1)).to.not.be.reverted

        const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)

        await expect(
            Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof, 1, 'bjp')
        ).to.not.be.reverted;

        await expect(Contract.connect(signer).addPoll(3, ['bjp', 'cong'])).to.not.be.reverted
        await expect(Contract.connect(signer).startPoll(2)).to.not.be.reverted
        const [nullifierHash1, proof1] = await getProof(ACTION_ID, callerAddr)

        await expect(
            Contract.connect(signer).verifyAndExecute(
                callerAddr,
                await getRoot(),
                nullifierHash1,
                proof1,
                2,
                'bjp'
            )
        ).to.not.be.reverted;
        const votes1=await Contract.getVotes(1);
        const parties1=await Contract.getParties(1);
        const parties2= await Contract.getParties(2);
        console.log(votes1);
        console.log(parties1);
        console.log(parties2);
    })

    // it('Rejects calls with an invalid signal', async function () {
    //     await registerIdentity()

    //     const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)

    //     await expect(
    //         Contract.verifyAndExecute(Contract.address, await getRoot(), nullifierHash, proof)
    //     ).to.be.revertedWith('InvalidProof')

    //     // extra checks here
    // })
    // it('Rejects calls with an invalid proof', async function () {
    //     await registerIdentity()

    //     const [nullifierHash, proof] = await getProof(ACTION_ID, callerAddr)
    //     proof[0] = (BigInt(proof[0]) ^ BigInt(42)).toString()

    //     await expect(
    //         Contract.verifyAndExecute(callerAddr, await getRoot(), nullifierHash, proof)
    //     ).to.be.revertedWith('InvalidProof')

    //     // extra checks here
    // })
})
