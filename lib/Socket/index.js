
import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { makeCommunitiesSocket } from './communities.js';
import { installAlyaCompatibility } from './alya-compat.js';
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
    // Alya-compatible convenience APIs are part of the Yowtech fork itself.
    installAlyaCompatibility(socket, newConfig.alyaCompat);
    
    return socket;
};

export default makeWASocket;
//# sourceMappingURL=index.js.map
