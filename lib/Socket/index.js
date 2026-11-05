
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { enhanceSocket, setupHooks } from '../Utils/index.js';

// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    const socket = makeCommunitiesSocket(newConfig);
    
    // Apply Enchanted Enhancements
    enhanceSocket(socket);
    setupHooks(socket);
    
    return socket;
};

export default makeWASocket;
//# sourceMappingURL=index.js.map
