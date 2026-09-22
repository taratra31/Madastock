import app from './app';
import { env } from './config/env';

const port = env.PORT;

app.listen(port, () => {
  console.log(`MadaStock API running on http://localhost:${port}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});