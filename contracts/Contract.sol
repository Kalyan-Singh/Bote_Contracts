// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import { ByteHasher } from './helpers/ByteHasher.sol';
import { IWorldID } from './interfaces/IWorldID.sol';
import "@openzeppelin/contracts/utils/Counters.sol";


contract Contract {
    using ByteHasher for bytes;
    using Counters for Counters.Counter;
    Counters.Counter private _pollId;

    ///////////////////////////////////////////////////////////////////////////////
    ///                                  ERRORS                                ///
    //////////////////////////////////////////////////////////////////////////////

    /// @notice Thrown when attempting to reuse a nullifier
    error InvalidNullifier();
    error NotStarted();
    error Ended();

    /// @dev The WorldID instance that will be used for verifying proofs
    IWorldID internal immutable worldId;

    /// @dev The application's action ID
    uint256 internal immutable actionId;

    /// @dev The WorldID group ID (1)
    uint256 internal immutable groupId = 1;
    enum State{
        started,
        ended,
        notStarted
    }

    /// @dev Whether a nullifier hash has been used already. Used to prevent double-signaling
    mapping(bytes32 => bool) internal nullifierHashes;
    mapping (uint =>uint) internal timings;
    event ResultAnnounced(uint[] indexed result);
    event Voted(string confirmation); 
    event PollStarted(uint indexed id);
    event PollCreated(uint indexed id, uint indexed duration);
    struct Poll {
        uint PollID;
        address creator;
        string[] parties;
        uint[] votes;
        State c_state;
        uint duration;
    }
    Poll[] internal polls;

    /// @param _worldId The WorldID instance that will verify the proofs
    /// @param _actionId The action ID for your application
    constructor(IWorldID _worldId, string memory _actionId) {
        worldId = _worldId;
        actionId = abi.encodePacked(_actionId).hashToField();
    }

    // Polling functions 

    function addPoll(uint _duration,string[] memory _parties)  external {
        Poll memory new_poll;
        _pollId.increment();
        new_poll.PollID=_pollId.current();
        new_poll.creator=msg.sender;
        new_poll.parties=_parties;
        new_poll.c_state=State.notStarted;
        new_poll.duration=_duration;
        new_poll.votes=new uint[](_parties.length);
        polls.push(new_poll);
        emit PollCreated(new_poll.PollID, new_poll.duration);
    }
    function startPoll(uint _pollID) public {
        require(_pollId.current()>=_pollID,"Given poll id does not exist");
        require(msg.sender==polls[_pollID-1].creator,"You do not have the permission to start the poll!");
        require(polls[_pollID-1].c_state==State.notStarted,"The poll was started before");
        timings[_pollID-1]=block.timestamp+polls[_pollID-1].duration*1 minutes;
        polls[_pollID-1].c_state=State.started;
        emit PollStarted(_pollID);
    }
    


    // Main voting function 

    /// @param input User's input, used as the signal. Could be something else! (see README)
    /// @param root The of the Merkle tree, returned by the SDK.
    /// @param nullifierHash The nullifier for this proof, preventing double signaling, returned by the SDK.
    /// @param proof The zero knowledge proof that demostrates the claimer is registered with World ID, returned by the SDK.
    /// @param _pollID the poll id which you want to vote for
    /// @param _partyName the party which you want to vote for
    function verifyAndExecute(
        address input,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof,
        uint _pollID,
        string memory _partyName
    ) public {
        // first, we make sure this person hasn't done this before
        // generating a new nullifier hash to make sure that each person will be able to vote for each pole
        bytes32 new_hash=keccak256(abi.encodePacked(nullifierHash,_pollID));
        if (nullifierHashes[new_hash]) revert InvalidNullifier();

        // then, we verify they're registered with WorldID, and the input they've provided is correct
        worldId.verifyProof(
            root,
            groupId,
            abi.encodePacked(input).hashToField(),
            nullifierHash,
            actionId,
            proof
        );

        // finally, we record they've done this, so they can't do it again (proof of uniqueness)
        nullifierHashes[new_hash] = true;

        // your logic here, make sure to emit some kind of event afterwards!
        require(_pollId.current()>=_pollID,"Given poll id does not exist");
        // require(polls[_pollID-1].c_state==State.started,"The poll has not been started yet!");
        // checks for the correct state
        if(polls[_pollID-1].c_state!=State.started){
            if(polls[_pollID-1].c_state==State.ended){
                revert Ended();
            }
            else{
                revert NotStarted();
            }
        }
        // changes state if poll has ended
        if(block.timestamp>timings[_pollID-1]){
            polls[_pollID-1].c_state=State.ended;
            revert Ended();
        }
        // require(block.timestamp<=timings[_pollID-1],"The poll has ended");
        bool hasParty=false;
        uint indParty;
        for(uint i=0;i<polls[_pollID-1].parties.length;i++){
            if(keccak256(abi.encodePacked(polls[_pollID-1].parties[i]))==keccak256(abi.encodePacked(_partyName))){
                hasParty=true;
                indParty=i;
            }
        }
        require(hasParty,"There is no such party");
        polls[_pollID-1].votes[indParty]++;
        emit Voted("Your response has been recorded");
    }

    //getter functions
    // function showResult(uint _pollID) public returns (uint[]memory){
    //     require(_pollId.current()>=_pollID,"Given poll id does not exist");
    //     require(block.timestamp>timings[_pollID-1],"The poll has not ended yet");
    //     polls[_pollID-1].c_state=State.ended;
    //     emit ResultAnnounced(polls[_pollID-1].votes);
    //     return polls[_pollID-1].votes;
    // }
    function getState(uint _pollID) public view returns(State){
        require(_pollId.current()>=_pollID,"Given poll id does not exist");
        return polls[_pollID-1].c_state;
    }

    function getParties(uint pollID) public view returns(string[] memory){
        require(pollID<=_pollId.current(),"The given poll ID does not exist");
        return polls[pollID-1].parties;
    }

    function getVotes(uint pollID) public view returns (uint[] memory){
        require(pollID<=_pollId.current(),"The given poll ID does not exist");
        return polls[pollID-1].votes;
    }

    function myPolls() public view returns (Poll[] memory){
        uint count=0;
        for(uint i=0;i<polls.length;i++){
            if(polls[i].creator==msg.sender){
                count++;
            }
        }
        Poll[] memory m_polls=new Poll[](count);
        uint j=0;
        for(uint i=0;i<polls.length;i++){
            if(polls[i].creator==msg.sender){
                m_polls[j]=polls[i];
                j++;
            }
        }
        return m_polls;
    }
}
