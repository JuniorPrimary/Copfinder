import path from 'node:path';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve('.env');
dotenv.config({ path: ENV_PATH });

