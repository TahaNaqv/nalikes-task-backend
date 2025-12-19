/**
 * Test script to verify all models are working correctly
 * Run with: node src/test-models.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const User = require('./models/User');
const GameSession = require('./models/GameSession');
const PlayerSession = require('./models/PlayerSession');
const TokenReward = require('./models/TokenReward');

async function testModels() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        
        console.log('\n=== Testing User Model ===');
        // Test User creation with validation
        const testUser = new User({
            username: 'testuser123',
            walletAddress: '0x1234567890123456789012345678901234567890'
        });
        await testUser.save();
        console.log('✓ User created successfully');
        
        // Test User methods
        await testUser.incrementSessionsJoined();
        console.log('✓ incrementSessionsJoined() works');
        
        // Test static methods
        const foundUser = await User.findByWalletAddress('0x1234567890123456789012345678901234567890');
        console.log('✓ findByWalletAddress() works');
        
        console.log('\n=== Testing GameSession Model ===');
        const testSession = new GameSession({
            creatorId: testUser._id,
            durationMinutes: 10,
            maxPlayers: 50,
            minPlayersToStart: 2
        });
        await testSession.save();
        console.log('✓ GameSession created successfully');
        console.log(`  Session ID: ${testSession.sessionId}`);
        console.log(`  Status: ${testSession.status}`);
        console.log(`  Player Count: ${testSession.playerCount}`);
        console.log(`  Is Full: ${testSession.isFull}`);
        
        // Test static methods
        const waitingSessions = await GameSession.findWaiting();
        console.log('✓ findWaiting() works');
        
        console.log('\n=== Testing PlayerSession Model ===');
        const testPlayerSession = new PlayerSession({
            sessionId: testSession._id,
            userId: testUser._id,
            score: 0,
            tasksCompleted: 0
        });
        await testPlayerSession.save();
        console.log('✓ PlayerSession created successfully');
        
        // Test methods
        await testPlayerSession.incrementScore(10);
        console.log('✓ incrementScore() works');
        await testPlayerSession.completeTask(10);
        console.log('✓ completeTask() works');
        
        // Test static methods
        const leaderboard = await PlayerSession.getLeaderboard(testSession._id);
        console.log('✓ getLeaderboard() works');
        
        console.log('\n=== Testing TokenReward Model ===');
        const testReward = new TokenReward({
            sessionId: testSession._id,
            userId: testUser._id,
            tokenAmount: 100,
            contractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            network: 'MOCK'
        });
        await testReward.save();
        console.log('✓ TokenReward created successfully');
        
        // Test methods
        await testReward.markCompleted('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234');
        console.log('✓ markCompleted() works');
        
        // Test static methods
        const userRewards = await TokenReward.findByUser(testUser._id);
        console.log('✓ findByUser() works');
        
        console.log('\n=== Testing Indexes ===');
        // Check if indexes exist by trying to create duplicate
        try {
            const duplicateUser = new User({
                username: 'testuser123', // Duplicate username
                walletAddress: '0x9876543210987654321098765432109876543210'
            });
            await duplicateUser.save();
            console.log('✗ Duplicate username should have failed');
        } catch (error) {
            if (error.code === 11000) {
                console.log('✓ Unique index on username works');
            }
        }
        
        try {
            const duplicatePlayerSession = new PlayerSession({
                sessionId: testSession._id,
                userId: testUser._id, // Duplicate
                score: 0,
                tasksCompleted: 0
            });
            await duplicatePlayerSession.save();
            console.log('✗ Duplicate PlayerSession should have failed');
        } catch (error) {
            if (error.code === 11000) {
                console.log('✓ Compound unique index on (sessionId, userId) works');
            }
        }
        
        console.log('\n=== Cleanup ===');
        await TokenReward.deleteMany({});
        await PlayerSession.deleteMany({});
        await GameSession.deleteMany({});
        await User.deleteMany({});
        console.log('✓ Test data cleaned up');
        
        console.log('\n✅ All model tests passed!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run tests
testModels();

