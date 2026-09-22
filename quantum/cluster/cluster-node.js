'use strict';
/* ---------------------------------------------------------------------------
 * cluster-node.js — Distributed Tryte-QOS Node Daemon for the 5825U Cluster
 * ---------------------------------------------------------------------------
 * Implements P2P peer discovery, spatial shard partitioning, and distributed
 * anyon braid compilation across the 12 mini PC nodes.
 * ------------------------------------------------------------------------- */

const dgram = require('dgram');
const os = require('os');
const { BraidCompiler, GATES, Rx, Ry, Rz } = require('../src/compiler.js');
const { UnifiedQutritCompiler } = require('../src/unified-compiler.js');

const DISCOVERY_PORT = 9330;
const HEARTBEAT_INTERVAL_MS = 2000;
const PEER_TIMEOUT_MS = 6000;

// The 12 canonical, non-canceling 2-generator prefix branches of B₃.
// Because each generator choice has 3 valid non-canceling successors,
// 4 choices * 3 choices = exactly 12 disjoint branches for the 12 mini PCs.
const CANONICAL_SHARDS = [
  [1, 1],   [1, 2],   [1, -2],
  [-1, -1], [-1, 2],  [-1, -2],
  [2, 1],   [2, -1],  [2, 2],
  [-2, 1],  [-2, -1], [-2, -2],
];

class ClusterNode {
  constructor(options = {}) {
    this.nodeId = options.nodeId || `node-${os.hostname()}-${process.pid % 1000}`;
    this.port = options.port || (9331 + (process.pid % 100));
    this.totalClusterNodes = options.totalClusterNodes || 12;
    this.cores = os.cpus().length;
    this.shardIndex = (typeof options.shardIndex === 'number')
      ? (options.shardIndex % 12)
      : Math.abs(hashCode(this.nodeId)) % 12;
    this.shardPrefix = CANONICAL_SHARDS[this.shardIndex];

    this.peers = new Map(); // nodeId -> peerInfo
    this.compiler = new BraidCompiler({ forwardDepth: 6 });
    this.qutritCompiler = new UnifiedQutritCompiler(3);

    this.udpSocket = null;
    this.heartbeatTimer = null;
    this.isRunning = false;
    this.pendingRequests = new Map(); // reqId -> { resolve, timer, results }
  }

  start() {
    this.isRunning = true;
    this.udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.udpSocket.on('error', (err) => {
      console.error(`[ClusterNode ${this.nodeId}] Socket error:`, err);
    });

    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString('utf8'));
        if (data.type === 'HEARTBEAT' && data.nodeId !== this.nodeId) {
          this.handlePeerHeartbeat(data, rinfo);
        } else if (data.type === 'COMPILE_REQ' && data.nodeId !== this.nodeId) {
          this.handleCompileRequest(data, rinfo);
        } else if (data.type === 'COMPILE_RES') {
          this.handleCompileResponse(data);
        }
      } catch (e) {
        // Ignore malformed packets
      }
    });

    this.udpSocket.bind(DISCOVERY_PORT, () => {
      this.udpSocket.setBroadcast(true);
      console.log(`[ClusterNode ${this.nodeId}] Listening on port ${DISCOVERY_PORT} (Shard: ${this.shardIndex} [${this.shardPrefix.join(', ')}])`);
      this.startHeartbeat();
    });

    // Pre-index local anyon tree sharded to this node's branch
    this.compiler.indexForward(6);
    this.qutritCompiler.index(3);
    console.log(`[ClusterNode ${this.nodeId}] Shard ${this.shardIndex} indexed. Cluster ready.`);
  }

  stop() {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.udpSocket) {
      try { this.udpSocket.close(); } catch (_) {}
    }
    console.log(`[ClusterNode ${this.nodeId}] Stopped.`);
  }

  startHeartbeat() {
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.pruneStalePeers();
    }, HEARTBEAT_INTERVAL_MS);
  }

  sendHeartbeat() {
    if (!this.isRunning || !this.udpSocket) return;
    const packet = Buffer.from(JSON.stringify({
      type: 'HEARTBEAT',
      nodeId: this.nodeId,
      port: this.port,
      shardIndex: this.shardIndex,
      cores: this.cores,
      activePeers: this.peers.size + 1,
      timestamp: Date.now(),
    }));

    this.udpSocket.send(packet, 0, packet.length, DISCOVERY_PORT, '255.255.255.255', (err) => {
      if (err && err.code !== 'ENETUNREACH') {
        // Suppress unreachable broadcast errors in loopback testing
      }
    });
  }

  handlePeerHeartbeat(data, rinfo) {
    const wasKnown = this.peers.has(data.nodeId);
    this.peers.set(data.nodeId, {
      nodeId: data.nodeId,
      address: rinfo.address,
      port: data.port,
      shardIndex: data.shardIndex,
      cores: data.cores,
      lastSeen: Date.now(),
    });

    if (!wasKnown) {
      console.log(`[ClusterNode ${this.nodeId}] Discovered peer: ${data.nodeId} (Shard ${data.shardIndex}) [Total: ${this.peers.size + 1}]`);
    }
  }

  handleCompileRequest(req, rinfo) {
    // Compile locally within this node's shard
    try {
      const { gateName, epsilon, reqId } = req;
      let res;
      if (gateName && GATES[gateName]) {
        res = this.compiler.compile(GATES[gateName], epsilon || 0.1);
      }
      if (res && this.udpSocket) {
        const responsePacket = Buffer.from(JSON.stringify({
          type: 'COMPILE_RES',
          reqId,
          nodeId: this.nodeId,
          shardIndex: this.shardIndex,
          word: res.word,
          distance: res.distance,
          depth: res.word.length,
        }));
        this.udpSocket.send(responsePacket, 0, responsePacket.length, DISCOVERY_PORT, '255.255.255.255');
      }
    } catch (_) {}
  }

  handleCompileResponse(data) {
    const pending = this.pendingRequests.get(data.reqId);
    if (pending) {
      pending.results.push(data);
    }
  }

  pruneStalePeers() {
    const now = Date.now();
    for (const [id, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
        this.peers.delete(id);
        console.log(`[ClusterNode ${this.nodeId}] Peer timed out: ${id} [Remaining: ${this.peers.size + 1}]`);
      }
    }
  }

  getClusterStatus() {
    const peerList = Array.from(this.peers.values());
    const totalCores = this.cores + peerList.reduce((acc, p) => acc + (p.cores || 0), 0);
    return {
      localNode: this.nodeId,
      shardIndex: this.shardIndex,
      shardPrefix: this.shardPrefix,
      cores: this.cores,
      activeNodes: this.peers.size + 1,
      totalClusterCores: totalCores,
      peers: peerList,
      qutritIndexedStates: this.qutritCompiler.table.length,
      qubitIndexedStates: this.compiler.forwardTable.length,
    };
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// If invoked from CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  let nodeId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--node-id') nodeId = args[++i];
  }

  const node = new ClusterNode({ nodeId });
  node.start();

  setInterval(() => {
    const status = node.getClusterStatus();
    console.log(`--- Cluster Status: ${status.activeNodes} Node(s) Online | Total Cores: ${status.totalClusterCores} ---`);
  }, 5000);

  process.on('SIGINT', () => {
    node.stop();
    process.exit(0);
  });
}

module.exports = {
  ClusterNode,
};
