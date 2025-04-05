module.exports = {
     presets: [
       '@babel/preset-env',  // For general JavaScript features
       ['@babel/preset-react', { runtime: 'automatic' }],  // For JSX syntax with automatic runtime
       '@babel/preset-typescript',  // For TypeScript support
     ],
   };