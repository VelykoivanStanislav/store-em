const azure = require('azure-storage');

const azureConnectionString = 'AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';
const tableService = azure.createTableService(azureConnectionString);
const categoriesTableName = 'categories';


const getAllCategories = (req, res) => {
  const query = new azure.TableQuery();
  tableService.queryEntities(categoriesTableName, query, null, (error, result, response) => {
    if (error) {
      console.error(`Error retrieving categories: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      const categories = result.entries.map(entry => {
        return {
          name: entry.name._,
        };
      });
      res.json(categories);
    }
  });
};


const getCategoryById = (req, res) => {
  const categoryId = req.params.id;
  const partitionKey = 'default';
  tableService.retrieveEntity(categoriesTableName, partitionKey, categoryId, (error, result, response) => {
    if (error) {
      console.error(`Error retrieving category: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      const category = {
        id: result.RowKey._,
        name: result.name._,
        parentCategory: result.parentCategory._,
      };
      res.json(category);
    }
  });
};


const addCategory = (req, res) => {
  const newCategory = req.body;


  if (!newCategory || !newCategory.name) {
    return res.status(400).send('Bad Request: Category name is required');
  }


  const partitionKey = 'default';
  const rowKey = Date.now().toString();


  const categoryEntity = {
    PartitionKey: { _: partitionKey },
    RowKey: { _: rowKey },
    name: { _: newCategory.name },
  };


  if (newCategory.parentCategory) {
    categoryEntity.parentCategory = { _: newCategory.parentCategory };
  }


  tableService.insertEntity(categoriesTableName, categoryEntity, (error, result, response) => {
    if (error) {
      console.error(`Error adding category: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      res.send('Category added successfully!');
    }
  });
};


const editCategory = (req, res) => {
  const categoryId = req.params.id;
  const editedCategory = req.body;

  tableService.mergeEntity(categoriesTableName, editedCategory, (error, result, response) => {
    if (error) {
      console.error(`Error editing category: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      res.send('Category edited successfully!');
    }
  });
};


const deleteCategory = (req, res) => {
  const categoryId = req.params.id;
  const partitionKey = 'default';
  tableService.deleteEntity(categoriesTableName, partitionKey, categoryId, (error, result, response) => {
    if (error) {
      console.error(`Error deleting category: ${error}`);
      res.status(500).send('Internal Server Error');
    } else {
      res.send('Category deleted successfully!');
    }
  });
};

module.exports = {
  getAllCategories,
  getCategoryById,
  addCategory,
  editCategory,
  deleteCategory,
};