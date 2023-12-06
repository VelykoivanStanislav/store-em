const azure = require('azure-storage');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');


const azureConnectionString = 'AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';
const tableService = azure.createTableService(azureConnectionString);
const productsTableName = 'products';
const containerClient = BlobServiceClient.fromConnectionString(azureConnectionString).getContainerClient('productimages');


const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });


const addProduct = (req, res) => {
  const newProduct = req.body;
  newProduct.RowKey = Date.now().toString();
  newProduct.PartitionKey = 'default';


  if (req.file) {
    const imageBlobName = `image_${Date.now()}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(imageBlobName);
    const imageBuffer = req.file.buffer;
    blockBlobClient.upload(imageBuffer, imageBuffer.length);

    newProduct.image = imageBlobName;
  }
  newProduct.category = req.body.category;
  tableService.insertEntity(productsTableName, newProduct, (error, result, response) => {
    if (error) {
      console.error(`Error adding product: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      res.send('Product added successfully!');
    }
  });
};


const getAllProductsWithImages = (req, res) => {
  const query = new azure.TableQuery();
  tableService.queryEntities(productsTableName, query, null, (error, result, response) => {
    if (error) {
      console.error(`Error retrieving products: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      const products = result.entries.map(entry => {
        return {
          name: entry.name._,
          price: entry.price._,
          category: entry.category._,
          image: entry.image ? entry.image._ : null, 
          thumbnail: entry.thumbnail ? entry.thumbnail._ : null, 
        };
      });
      res.json(products);
    }
  });
};


const getProductById = (req, res) => {
    const productId = req.params.id;
    const query = new azure.TableQuery().where('RowKey eq ?', productId);
  
    tableService.queryEntities(productsTableName, query, null, (error, result, response) => {
      if (error) {
        console.error(`Error retrieving product by id: ${error}`);
        res.status(500).send('Internal Server Error');
      } else {
        if (result.entries.length > 0) {
          const entry = result.entries[0];
          const product = {
            id: entry.RowKey._,
            name: entry.name._,
            price: entry.price._,
            category: entry.category._,
            image: entry.image ? getBlobUrl(entry.image._) : null,
            thumbnail: entry.thumbnail ? getBlobUrl(entry.thumbnail._) : null,
          };
          res.json(product);
        } else {
          res.status(404).send('Product not found');
        }
      }
    });
  };


const getProductsByCategory = (req, res) => {
    const category = req.params.category;
    const query = new azure.TableQuery().where('category eq ?', category);
  
    tableService.queryEntities(productsTableName, query, null, (error, result, response) => {
      if (error) {
        console.error(`Error retrieving products by category: ${error}`);
        res.status(500).send('Internal Server Error');
      } else {
        const products = result.entries.map(entry => {
          return {
            id: entry.RowKey._,
            name: entry.name._,
            category: entry.category._,
            image: entry.image._,
            thumbnail: entry.thumbnail ? getBlobUrl(entry.thumbnail._) : null,
          };
        });
        res.json(products);
      }
    });
  };

module.exports = {
  addProduct,
  getAllProductsWithImages,
  getProductById,
  getProductsByCategory,
};
