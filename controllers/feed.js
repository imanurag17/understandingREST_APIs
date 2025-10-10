const fs = require('fs')
const path = require('path')
const { validationResult } = require('express-validator')

const Post = require('../models/posts')
const User = require('../models/users')

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;
  Post.find()
    .countDocuments()
    .then(count => {
      totalItems = count;
      return Post.find()
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    })
    .then(posts => {
      res
        .status(200)
        .json({
          message: 'Fetched posts successfully.',
          posts: posts,
          totalItems: totalItems
        });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
}

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path;
  const title = req.body.title;
  const content = req.body.content;
  let creator;
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });
  post
    .save()
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      creator = user;
      user.post.push(post);
      return user.save();
    })
    .then(result => {
      res.status(201).json({
        message: 'Post created successfully!',
        post: post,
        creator: { _id: creator._id, name: creator.name }
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId
  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('Could not find post')
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ message: 'post fetched', post: post })
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    })
}

exports.updatePost = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const postId = req.params.postId
  const title = req.body.title
  const content = req.body.content
  let imageUrl = req.body.image

  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/")
  }
  if (!imageUrl) {
    const error = new Error('No file picked')
    error.statusCode = 422
    throw error
  }

  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('Could not find post')
        error.statusCode = 404;
        throw error;
      }
      if(post.creator.toString() !== req.userId){
        const error = new Error('Not Authenticated')
        error.statusCode = 403
        throw error
      }
      if (imageUrl !== post.imageUrl) {
        clearImage(post.imageUrl)
      }
      post.title = title
      post.content = content
      post.imageUrl = imageUrl
      return post.save()
    })
    .then(result => {
      res.status(200).json({ message: 'Post Updated', post: result })
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    })
}

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId
  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('Could not find post')
        error.statusCode = 404;
        throw error;
      }
      if(post.creator.toString() !== req.userId){
        const error = new Error('Not Authenticated')
        error.statusCode = 403
        throw error
      }
      clearImage(post.imageUrl)
      return Post.findByIdAndDelete(postId)
    })
    .then(result => {
      return User.findById(req.userId)
    })
    .then(user => {
      user.post.pull(postId)
      return user.save()
    })
    .then(result => {
      res.status(200).json({ message: 'Post Deleted' })
    })
    .catch(error => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    })
}

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath)
  fs.unlink(filePath, error => console.log(error))
}