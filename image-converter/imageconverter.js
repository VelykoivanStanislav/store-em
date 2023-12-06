const { QueueServiceClient } = require('@azure/storage-queue');
const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');

const connectionString = 'AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';

const queueName = 'imagequeue';
const blobContainerName = 'productimages';

const queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);
const queueClient = queueServiceClient.getQueueClient(queueName);

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const blobContainerClient = blobServiceClient.getContainerClient(blobContainerName);

const processQueueMessage = async (message) => {
  try {
    // Извлечение имени блоба из сообщения в очереди
    const { blobName } = JSON.parse(message.messageText);
    console.log(`Processing image: ${blobName}`);

    // Получение клиента блоба для загрузки изображения
    const blockBlobClient = blobContainerClient.getBlockBlobClient(blobName);

    // Загрузка изображения из Blob Storage
    const imageBuffer = await blockBlobClient.downloadToBuffer();

    // Ваш код для конвертации изображения 64x64
    const convertedImageBuffer = await sharp(imageBuffer)
      .resize(64, 64)
      .toBuffer();

    // Загрузка конвертированного изображения в Blob Storage
    const convertedBlobName = `converted_${blobName}`;
    const convertedBlobClient = blobContainerClient.getBlockBlobClient(convertedBlobName);
    await convertedBlobClient.upload(convertedImageBuffer, convertedImageBuffer.length, { overwrite: true });

    // Удаление старого блоба
    await blockBlobClient.delete();

    console.log(`Image converted and uploaded: ${convertedBlobName}`);

    // Удаление сообщения из очереди после успешной обработки
    await queueClient.deleteMessage(message.messageId, message.popReceipt);
  } catch (error) {
    console.error('Error processing queue message:', error.message);
  }
};

const listenToQueue = async () => {
  console.log('Listening to the image conversion queue...');
  while (true) {
    const messages = await queueClient.receiveMessages({ maxMessages: 1, visibilityTimeout: 5 * 60 });
    if (messages.receivedMessageItems.length > 0) {
      const message = messages.receivedMessageItems[0];
      await processQueueMessage(message);
    } else {
      // Пауза, если в очереди нет сообщений
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

listenToQueue().catch((error) => console.error('Error in image converter:', error));
