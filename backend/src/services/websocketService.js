import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class WebSocketService extends EventEmitter {
  constructor({ oneInchService, suiService, logger }) {
    super();

    this.oneInchService = oneInchService;
    this.suiService = suiService;
    this.logger = logger;
    this.wss = null;
    this.clients = new Map(); // Track connected clients

    // Event types we support
    this.eventTypes = {
      ORDER_CREATED: 'order_created',
      ORDER_FILLED: 'order_filled',
      ORDER_CANCELLED: 'order_cancelled',
      ESCROW_CREATED: 'escrow_created',
      ESCROW_CLAIMED: 'escrow_claimed',
      ESCROW_CANCELLED: 'escrow_cancelled',
      PRICE_UPDATE: 'price_update',
      RESOLVER_STATUS: 'resolver_status'
    };

    this.logger.info('WebSocket service initialized');
  }

  setupServer(httpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.logger.info('WebSocket server setup completed');
  }

  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      connectedAt: new Date(),
      subscriptions: new Set(),
      isAlive: true
    };

    this.clients.set(clientId, clientInfo);

    this.logger.info('WebSocket client connected', {
      clientId,
      ip: request.socket.remoteAddress
    });

    // Setup ping/pong for connection health
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.logger.error('WebSocket error', { clientId, error });
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
      supportedEvents: Object.values(this.eventTypes)
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(clientId);

      if (!client) return;

      this.logger.debug('WebSocket message received', { clientId, message });

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.events);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.events);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'get_status':
          this.sendResolverStatus(clientId);
          break;
        default:
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Unknown message type',
            receivedType: message.type
          });
      }
    } catch (error) {
      this.logger.error('Error handling WebSocket message', { clientId, error });
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  handleSubscribe(clientId, events) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validEvents = events.filter(event =>
      Object.values(this.eventTypes).includes(event)
    );

    validEvents.forEach(event => client.subscriptions.add(event));

    this.sendToClient(clientId, {
      type: 'subscribed',
      events: validEvents,
      totalSubscriptions: client.subscriptions.size
    });

    this.logger.debug('Client subscribed to events', {
      clientId,
      events: validEvents
    });
  }

  handleUnsubscribe(clientId, events) {
    const client = this.clients.get(clientId);
    if (!client) return;

    events.forEach(event => client.subscriptions.delete(event));

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      events,
      totalSubscriptions: client.subscriptions.size
    });

    this.logger.debug('Client unsubscribed from events', {
      clientId,
      events
    });
  }

  handleDisconnection(clientId) {
    this.clients.delete(clientId);
    this.logger.info('WebSocket client disconnected', { clientId });
  }

  // Broadcast methods for different event types
  broadcastOrderCreated(orderData) {
    this.broadcast(this.eventTypes.ORDER_CREATED, {
      orderId: orderData.orderId,
      fromToken: orderData.fromToken,
      toToken: orderData.toToken,
      amount: orderData.amount,
      creator: orderData.creator,
      timestamp: new Date().toISOString()
    });
  }

  broadcastOrderFilled(orderData) {
    this.broadcast(this.eventTypes.ORDER_FILLED, {
      orderId: orderData.orderId,
      filledAmount: orderData.filledAmount,
      price: orderData.price,
      resolver: orderData.resolver,
      timestamp: new Date().toISOString()
    });
  }

  broadcastOrderCancelled(orderData) {
    this.broadcast(this.eventTypes.ORDER_CANCELLED, {
      orderId: orderData.orderId,
      reason: orderData.reason,
      timestamp: new Date().toISOString()
    });
  }

  broadcastEscrowCreated(escrowData) {
    this.broadcast(this.eventTypes.ESCROW_CREATED, {
      escrowId: escrowData.escrowId,
      sender: escrowData.sender,
      recipient: escrowData.recipient,
      amount: escrowData.amount,
      hash: escrowData.hash,
      expiry: escrowData.expiry,
      crossChainId: escrowData.crossChainId,
      timestamp: new Date().toISOString()
    });
  }

  broadcastEscrowClaimed(escrowData) {
    this.broadcast(this.eventTypes.ESCROW_CLAIMED, {
      escrowId: escrowData.escrowId,
      claimer: escrowData.claimer,
      secret: escrowData.secret,
      amount: escrowData.amount,
      timestamp: new Date().toISOString()
    });
  }

  broadcastEscrowCancelled(escrowData) {
    this.broadcast(this.eventTypes.ESCROW_CANCELLED, {
      escrowId: escrowData.escrowId,
      refundTo: escrowData.refundTo,
      amount: escrowData.amount,
      timestamp: new Date().toISOString()
    });
  }

  broadcastPriceUpdate(priceData) {
    this.broadcast(this.eventTypes.PRICE_UPDATE, {
      token: priceData.token,
      price: priceData.price,
      change24h: priceData.change24h,
      volume24h: priceData.volume24h,
      timestamp: new Date().toISOString()
    });
  }

  broadcastResolverStatus(statusData) {
    this.broadcast(this.eventTypes.RESOLVER_STATUS, {
      resolver: statusData.resolver,
      status: statusData.status,
      activeSwaps: statusData.activeSwaps,
      successRate: statusData.successRate,
      timestamp: new Date().toISOString()
    });
  }

  // Generic broadcast method
  broadcast(eventType, data) {
    const message = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(eventType)) {
        this.sendToClient(clientId, message);
        sentCount++;
      }
    }

    this.logger.debug('Broadcasted event', {
      eventType,
      sentCount,
      totalClients: this.clients.size
    });
  }

  // Send message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);

    if (!client || client.ws.readyState !== 1) { // 1 = OPEN
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.logger.error('Error sending message to client', { clientId, error });
      this.clients.delete(clientId);
      return false;
    }
  }

  // Send resolver status to specific client
  async sendResolverStatus(clientId) {
    try {
      // This would integrate with the resolver bot to get current status
      const status = {
        isRunning: true,
        activeSwaps: 0,
        completedSwaps: 0,
        failedSwaps: 0,
        uptime: process.uptime(),
        lastHealthCheck: new Date().toISOString()
      };

      this.sendToClient(clientId, {
        type: 'resolver_status',
        data: status
      });
    } catch (error) {
      this.logger.error('Error sending resolver status', { clientId, error });
    }
  }

  // Health check for connected clients
  startHealthCheck() {
    setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  // Utility methods
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClients() {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      subscriptions: Array.from(client.subscriptions),
      isAlive: client.isAlive
    }));
  }

  getClientCount() {
    return this.clients.size;
  }

  // Event listeners for integration with other services
  setupEventListeners() {
    // Listen to 1inch events (if available)
    if (this.oneInchService) {
      this.oneInchService.on?.('order_created', (data) => {
        this.broadcastOrderCreated(data);
      });

      this.oneInchService.on?.('order_filled', (data) => {
        this.broadcastOrderFilled(data);
      });
    }

    // Listen to Sui events
    if (this.suiService) {
      this.suiService.on?.('escrow_created', (data) => {
        this.broadcastEscrowCreated(data);
      });

      this.suiService.on?.('escrow_claimed', (data) => {
        this.broadcastEscrowClaimed(data);
      });
    }
  }

  // Cleanup method
  close() {
    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.terminate();
      });
      this.wss.close();
    }

    this.clients.clear();
    this.logger.info('WebSocket service closed');
  }
}