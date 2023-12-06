const express = require('express');
const azure = require('azure-storage');
const categoryController = require('./categoryController');
const productController = require('./productController');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const bodyParser = require('body-parser');
const { QueueServiceClient } = require('@azure/storage-queue');
const sharp = require('sharp');
const multer = require('multer');
const cors = require('cors');
const app = express();
const port = 3000;
const azureConnectionString = 'AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';
const queueServiceClient = QueueServiceClient.fromConnectionString(azureConnectionString);
const imageQueueClient = queueServiceClient.getQueueClient('imagequeue');

const upload = multer({ storage: multer.memoryStorage() });
const storage = multer.memoryStorage();
app.use(bodyParser.json());
app.use(cors());
app.get('/categories', categoryController.getAllCategories);
app.get('/categories/:id', categoryController.getCategoryById);
app.post('/categories', categoryController.addCategory);
app.put('/categories/:id', categoryController.editCategory);
app.delete('/categories/:id', categoryController.deleteCategory);
app.use('/images', express.static(path.join(__dirname, 'public')));

app.post('/products', upload.single('image'), productController.addProduct);
app.get('/products', productController.getAllProductsWithImages);
app.get('/products/:id', productController.getProductById);
app.get('/products/category/:category', productController.getProductsByCategory);


app.post('/uploadImage/:imageName', upload.single('image'), async (req, res) => {
  try {
    const imageName = req.params.imageName; 
    const imageBuffer = req.file.buffer;


    await imageQueueClient.sendMessage(JSON.stringify({ imageName, imageBuffer }));

    res.send('Image upload request received. Image will be processed shortly.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

const processImageQueue = async () => {
  try {
    const messages = await imageQueueClient.receiveMessages({ numberOfMessages: 1 });
    
    if (messages.receivedMessageItems.length > 0) {
      const message = messages.receivedMessageItems[0];
      const { productId, imageBuffer } = JSON.parse(message.messageText);


      const resizedImageBuffer = await sharp(imageBuffer).resize(64, 64).toBuffer();


      const blobName = `thumbnail_${productId}.jpg`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(resizedImageBuffer, resizedImageBuffer.length);


      await imageQueueClient.deleteMessage(message.messageId, message.popReceipt);

      console.log(`Image for product ${productId} processed and thumbnail saved.`);
    }
  } catch (error) {
    console.error(error);
  } finally {

    setTimeout(processImageQueue, 1000);
  }
};


processImageQueue();
app.get('/images/:imageName', async (req, res) => {
  const imageName = req.params.imageName;

  try {
    const blockBlobClient = containerClient.getBlockBlobClient(imageName);
    const downloadBlockBlobResponse = await blockBlobClient.download();
    const content = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);

    res.writeHead(200, {
      'Content-Type': downloadBlockBlobResponse.contentType,
      'Content-Length': content.length,
    });

    res.end(content);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(404).send('Image not found');
  }
});


async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}


const tableService = azure.createTableService(azureConnectionString);

const createTables = async () => {

  const categoriesTableName = 'categories';
  tableService.createTableIfNotExists(categoriesTableName, (error, result, response) => {
    if (error) {
      console.error(`Error creating categories table: ${error}`);
    } else {
      console.log('Categories table created successfully.');
    }
  });

  const productsTableName = 'products';
  tableService.createTableIfNotExists(productsTableName, (error, result, response) => {
    if (error) {
      console.error(`Error creating products table: ${error}`);
    } else {
      console.log('Products table created successfully.');
    }
  });

  console.log('Tables created successfully.');
};


const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
const containerClient = blobServiceClient.getContainerClient('productimages');
containerClient.createIfNotExists();

const createBlobQueue = async () => {
  const queueService = azure.createQueueService(azureConnectionString);
  const queueName = 'imagequeue';

  queueService.createQueueIfNotExists(queueName, (error, result, response) => {
    if (error) {
      console.error(`Error creating image queue: ${error}`);
    } else {
      console.log('Image queue created successfully.');
    }
  });
};


createTables();
createBlobQueue();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});