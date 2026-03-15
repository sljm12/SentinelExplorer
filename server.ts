import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy endpoint for Copernicus CDSE OData API to avoid CORS issues
  app.get('/api/proxy/copernicus/odata', async (req, res) => {
    try {
      const { filter, top, orderby, expand } = req.query;
      
      const url = new URL('https://catalogue.dataspace.copernicus.eu/odata/v1/Products');
      if (filter) url.searchParams.append('$filter', filter as string);
      if (top) url.searchParams.append('$top', top as string);
      if (orderby) url.searchParams.append('$orderby', orderby as string);
      if (expand) url.searchParams.append('$expand', expand as string);

      console.log('Proxying OData request to:', url.toString());

      const response = await fetch(url.toString());
      const data = await response.json();
      
      res.json(data);
    } catch (error) {
      console.error('OData Proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch from Copernicus OData API via proxy' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
