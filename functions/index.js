const functions = require('firebase-functions');
const admin = require('firebase-admin');

// for file type
// const mimeTypes = require('mimetypes');

// to enable this you need to pay. Comment to remove
// const rp = require('request-promise');

// needed to start
admin.initializeApp();

// Tips:
// TERMINAL DEPLOY AS: firebase deploy --only functions
// TERMINAL check env variables: firebase functions:config:get

exports.createAuthor = functions.https.onCall(async (data, context) => {
  checkAuthentication(context, true);

  dataValidator(data, {
    authorName: 'string'
  });

  const author = await admin
    .firestore()
    .collection('authors')
    .where('name', '==', data.authorName)
    .limit(1)
    .get();

  if (!author.empty) {
    throw new functions.https.HttpsError(
      'already-exists',
      'This author already exists'
    );
  }

  return admin.firestore().collection('authors').add({
    name: data.authorName
  });
});

exports.createBook = functions.https.onCall(async (data, context) => {
  checkAuthentication(context, true);

  dataValidator(data, {
    bookName: 'string',
    authorId: 'string',
    imageUrl: 'string',
    description: 'string',
    year: 'number'
  });

  // bookCover file manipulation. If uploading file
//   const mimeType = data.bookCover.match(
//     /data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/
//   )[1];
//   const base64EncodedImageString = data.bookCover.replace(
//     /^data:image\/\w+;base64,/,
//     ''
//   );
//   const imageBuffer = new Buffer(base64EncodedImageString, 'base64');

//   const filename = `bookCovers/${data.bookName}.${mimeTypes.detectExtension(
//     mimeType
//   )}`;
//   const file = admin.storage().bucket().file(filename);
//   await file.save(imageBuffer, { contentType: 'image/jpeg' });

//// fileUrl gets passed instead of imageUrl
//   const fileUrl = await file
//     .getSignedUrl({ action: 'read', expires: '03-09-2491' })
//     .then((urls) => urls[0]);

  admin
    .firestore()
    .collection('books')
    .add({
      title: data.bookName,
      imageUrl: data.imageUrl,
      author: admin.firestore().collection('authors').doc(data.authorId),
      description: data.description,
      year: data.year
    })
    // .then(() => {
    //     // to enable this you need to pay. 
    //     return rp.post('https://api.netlify.com/build_hooks/5f5f7b42b92f79089464273c')
    // })
    .catch(() => {
      return {
        message: 'An error occurred when creating a book'
      };
    });
});

// ATTEMPT AT PUBLIC PROFILE SERVER SIDE
exports.createPublicProfile = functions.https.onCall(async (data, context) => {
    checkAuthentication(context);
    dataValidator(data, {
      username: 'string'
    });
  
    const userProfile = await admin
      .firestore()
      .collection('publicProfiles')
      .where('userId', '==', context.auth.uid)
      .limit(1)
      .get();
  
    if (!userProfile.empty) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This user already has a public profile.'
      );
    }
  
    const publicProfile = await admin
      .firestore()
      .collection('publicProfiles')
      .doc(data.username)
      .get();
    if (publicProfile.exists) {
      throw new functions.https.HttpsError(
        'already-exists',
        'This username already belongs to an existing user.'
      );
    }
  
    const user = await admin.auth().getUser(context.auth.uid);
    if (user.email === functions.config().accounts.admin) {
    //   console.log(user.email, functions.config().accounts.admin);
      await admin.auth().setCustomUserClaims(context.auth.uid, { admin: true });
    }
  
    return admin.firestore().collection('publicProfiles').doc(data.username).set({
      userId: context.auth.uid
    });
  });

exports.postComment = functions.https.onCall(async (data, context) => {
    checkAuthentication(context);
    dataValidator(data, {
        bookId: "string",
        text: "string",
    });

    const db = admin.firestore();
    const snapshot = await db
        .collection("publicProfiles")
        .where("userId", "==", context.auth.uid)
        .limit(1)
        .get();
 
    await db.collection("comments").add({
        text: data.text,
        username: snapshot.docs[0].id,
        dateCreated: new Date(),
        book: db.collection("books").doc(data.bookId),
    });
 
});

// SERVER SIDE VALIDATION USING CLOUD FUNCTIONS

function dataValidator(data, validKeys) {
  if (Object.keys(data).length !== Object.keys(validKeys).length) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Data object contains invalid number of properties'
    );
  } else {
    for (let key in data) {
      if (!validKeys[key] || typeof data[key] !== validKeys[key]) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Data object contains invalid properties'
        );
      }
    }
  }
}

function checkAuthentication(context, admin) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to use this feature'
    );
  } 
  else if (!context.auth.token.admin && admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You must be an admin to use this feature.'
    );
  }
}