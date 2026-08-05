
POST /api/posts, PUT, DELETE → must require protect middleware

POST /api/media/upload → must require protect

POST /api/scout → public

GET /api/scout/approvals → adminOnly middleware

Comments can be public to post, or protected optionally