require 'mongoid'
require 'mongoid/grid_fs'
require 'carrierwave'
require 'carrierwave/mongoid'

# mongod --config /usr/local/etc/mongod.conf

Mongoid.load!(File.join(File.dirname(__FILE__), 'config', 'mongoid.yml'))

CarrierWave.configure do |config|
  config.storage = :grid_fs
  config.root = Sinatra::Application.root + '/tmp'
  config.cache_dir = 'uploads'
end

class ImageUploader < CarrierWave::Uploader::Base
  storage :grid_fs
end

class Scene
  include Mongoid::Document

  mount_uploader :image, ImageUploader

  field :start_xp, type: Float
  field :start_yp, type: Float

  embeds_many :shapes
  embeds_many :interactables

  belongs_to :user
  has_many :characters
end

class Interactable
  include Mongoid::Document

  field :interactable_type
  field :xp, type: Float
  field :yp, type: Float
  field :size, type: Float
  field :data, type: Hash

  embedded_in :scene
end

class InteractableTemplate
  include Mongoid::Document

  mount_uploader :image, ImageUploader

  field :interactable_type

  has_many :interactables
end

class Shape
  include Mongoid::Document

  field :near_scale, type: Float
  field :far_scale, type: Float
  field :min_yp, type: Float
  field :max_yp, type: Float
  field :shape_type
  field :points, type: Array

  embeds_one :warp

  embedded_in :scene
end

class Point
  include Mongoid::Document

  field :xp, type: Float
  field :yp, type: Float

  embedded_in :shape
end

class Warp
  include Mongoid::Document

  field :warp_type
  field :warp_id

  embedded_in :shape
end

class User
  include Mongoid::Document

  field :name
  field :password_hash

  has_one :character
  has_many :scenes
end

class Character
  include Mongoid::Document

  mount_uploader :image0, ImageUploader
  mount_uploader :image1, ImageUploader
  mount_uploader :image2, ImageUploader

  field :xp, type: Float
  field :yp, type: Float
  field :name, type: String

  has_many :treasures
  belongs_to :user, optional: true
  belongs_to :scene, optional: true
end

class Treasure
  include Mongoid::Document

  belongs_to :character
end