import {createServices} from './services.js';
import {createApp} from './app.js';
const services=createServices();const app=createApp(services);const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`BBEP website running on port ${port}. Auth configured: ${services.ready}. Google configured: ${services.googleReady}. Order mail configured: ${services.orderReady}.`));
