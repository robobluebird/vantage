require 'bcrypt'
require 'sinatra'
require 'mongoid'
require 'mongoid/grid_fs'
require 'carrierwave'
require 'carrierwave/mongoid'
require 'sysrandom'

include BCrypt

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

  has_many :characters
  belongs_to :user
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
  belongs_to :scene, optional: true
  belongs_to :user, optional: true
end

class Treasure
  include Mongoid::Document

  belongs_to :character
end

TYPE_FLOOR = 1
TYPE_MASK = 2
TYPE_BLOCK = 3
TYPE_WARP = 4

TYPE_LINK = 1
TYPE_TEXT = 2
TYPE_AUDIO = 3

TYPE_LOCAL_WARP = 1
TYPE_REMOTE_WARP = 2

use Mongoid::QueryCache::Middleware

use Rack::Session::Cookie, :key => 'rack.session', :path => '/', :secret => ENV.fetch('SESSION_SECRET') { SecureRandom.hex(64) }
use Rack::Protection, permitted_origins: ['http://localhost:4567']
use Rack::Protection::AuthenticityToken
use Rack::Protection::RemoteToken

configure :production do
  ::Logger.class_eval { alias :write :'<<' }
  @access_log = ::File.join(::File.dirname(::File.expand_path(__FILE__)),'log','access.log')
  @access_logger = ::Logger.new(@access_log)
  @error_logger = ::File.new(::File.join(::File.dirname(::File.expand_path(__FILE__)),'log','error.log'),"a+")
  @error_logger.sync = true
  use ::Rack::CommonLogger, @access_logger
end

helpers do
  def current_user 
    if session[:user_id]
      @user ||= User.find session[:user_id]
    end
  end
end

get '/signin' do
  erb :signin
end

post '/signin' do
  user = User.find_by name: params[:name]

  if Password.new(user.password_hash) == params[:password]
    session[:user_id] = user.id.to_s

    redirect to('/scenes')
  else
    500
  end
end

get '/signout' do
  session[:user_id] = nil
  
  redirect to('/scenes')
end

get '/signup' do
  erb :signup
end

post '/users' do
  if params[:name] &&
     params[:password] &&
     params[:password_confirmation] &&
     !params[:name].strip.length.zero? &&
     !params[:password].strip.length.zero? &&
     !params[:password_confirmation].strip.length.zero? &&
     params[:name].strip.match(/^[a-zA-Z0-9\-_]+$/) &&
     params[:password_confirmation].strip == params[:password].strip

     user = User.new
     user.name = params[:name].strip
     user.password_hash = Password.create params[:password].strip
     user.save!

     c = Character.new
     c.name = user.name
     c.user = user
     c.save!

     session[:user_id] = user.id.to_s

     redirect to('/scenes')
  else
    500
  end
end

get '/users' do
  @users = User.all
  erb :users_index
end

get '/scenes' do
  @scenes = Scene.all

  erb :scenes_index
end

get '/void' do
  Scene.destroy_all
end

get '/tally' do
  Scene.all.count.to_json
end

get '/scenes/new' do
  erb :scenes_new
end

get '/scenes/:scene_id' do
  @scene = Scene.find params[:scene_id]
  erb :scenes_show, layout: :scene_layout
end

get '/scenes/:scene_id/image' do
  @scene = Scene.find params[:scene_id]
  t = Tempfile.new
  t.write @scene.image.read
  t.rewind
  send_file t, type: @scene.image.file.content_type, disposition: "inline"
end

get '/scenes/:scene_id/json' do
  @scene = Scene.find params[:scene_id]

  res = {}

  if current_user
    res = {
      user: {
        id: current_user.id.to_s,
        name: current_user.name,
        character: current_user.character ? {id: current_user.character.id.to_s} : nil
      }
    }
  end
  
  res.merge({scene: @scene}).to_json
end

get '/interactable_templates' do
  @interactable_templates = InteractableTemplate.all
  erb :interactable_templates_index
end

get '/interactable_templates/:interactable_template_name/image' do
  @it = InteractableTemplate.find_by interactable_type: params[:interactable_template_name]
  t = Tempfile.new
  t.write @it.image.read
  t.rewind
  send_file t, type: @it.image.file.content_type, disposition: "inline"
end

get '/interactable_templates/new' do
  erb :interactable_templates_new
end

get '/characters' do
  @characters = Character.all
  erb :characters_index
end

get '/character/:character_id/json' do
  @character = Character.find params[:character_id]
  @character.to_json
end

get '/characters/:character_id/images/:image_index' do
  @character = Character.find params[:character_id]
  t = Tempfile.new
  t.write @character.send("image#{params[:image_index]}").read
  t.rewind
  send_file t, type: @character.send("image#{params[:image_index]}").file.content_type, disposition: "inline"
end

post '/interactable_templates' do
  i = InteractableTemplate.new
  i.interactable_type = params[:template_type]
  i.image = params[:file][:tempfile]
  i.save!
  redirect to("/interactable_templates")
end

post '/scenes' do
  s = Scene.new
  s.image = params[:file][:tempfile]
  s.save!
  redirect to("/scenes/#{s.id}/image")
end

post '/scenes/:scene_id/shapes' do
  s = Shape.new

  pts = params[:points].split('|').map do |str|
    parts = str.split(',')

    p = {}

    parts.map do |xpyp|
      x, y = xpyp.split('=')
      p[x] = y
    end

    p
  end

  s.near_scale = params[:near_scale]
  s.far_scale = params[:far_scale]
  s.min_yp = params[:min_yp]
  s.max_yp = params[:max_yp]
  s.shape_type = params[:shape_type]
  s.points = pts
  s.scene = Scene.find params[:scene_id]

  if s.save!
    s.to_json
  else
      {error: 'wut'}.to_json
  end
end

post '/scenes/:scene_id/interactables' do
  scene = Scene.find params[:scene_id]
  i = Interactable.new

  i.scene = Scene.find params[:scene_id]
  
  interactable_template = InteractableTemplate.find_by interactable_type: params[:interactable_type]

  raise 'what the fuck' unless interactable_template

  i.scene = scene
  i.interactable_type = params[:interactable_type]
  i.xp = params[:xp]
  i.yp = params[:yp]
  data = {}
  params[:data].split('|').each do |pair_string|
    pair = pair_string.split ':'
    data[pair.first] = pair.last
  end
  i.data = data
  i.size = params[:size]

  i.save!

  i.to_json
end

post '/scenes/:scene_id/interactables/:interactable_id/delete' do
  scene = Scene.find params[:scene_id]
  interactable = scene.interactables.find params[:interactable_id]
  interactable.destroy
  scene.to_json
end

post '/scenes/:scene_id/shapes/:shape_id' do
  scene = Scene.find params[:scene_id]
  shape = scene.shapes.find params[:shape_id]

  shape.near_scale = params[:near_scale]
  shape.far_scale = params[:far_scale]
  shape.shape_type = params[:shape_type]

  if params[:warp]
    if params[:warp] == "null"
      if shape.warp && shape.warp.warp_type == 'local'
        warp_to = scene.shapes.find shape.warp.warp_id
        warp_to.warp = nil
        warp_to.save!
      end
      shape.warp = nil
      shape.save!
    else
      warp = Warp.new
      warp_type_and_id = params[:warp].split '|'

      if warp_type_and_id.first == 'local'
        warp.warp_type = 'local'
        warp.warp_id = warp_type_and_id.last

        warp_to = scene.shapes.find warp_type_and_id.last
        warp_to_data = Warp.new
        warp_to_data.warp_type = 'local'
        warp_to_data.warp_id = shape.id.to_s
        warp_to.warp = warp_to_data
        warp_to.save!

        shape.warp = warp
        shape.save!
      else
        warp.warp_type = 'remote'
        warp.warp_id = warp_type_and_id.last
        
        shape.save!
      end
    end
  end

  shape.to_json
end

post '/scenes/:scene_id/shapes/:shape_id/delete' do
  scene = Scene.find params[:scene_id]
  shape = scene.shapes.find params[:shape_id]
  shape.destroy
  scene.to_json
end

post '/characters' do
  c = Character.new

  c.name = params[:name]
  c.image0 = params[:image0][:tempfile]
  c.image1 = params[:image1][:tempfile]
  c.image2 = params[:image2][:tempfile]
  c.save!

  redirect to('/characters')
end

get '/users/:user_id/character/update' do
  @user = User.find params[:user_id]

  erb :characters_new
end

get '/users/:user_id' do
  @user = User.find params[:user_id]

  erb :users_show
end

post '/users/:user_id/character' do
  user = User.find params[:user_id]
  character = user.character

  character.image0 = params[:image0][:tempfile]
  character.image1 = params[:image1][:tempfile]
  character.image2 = params[:image2][:tempfile]

  character.save!

  redirect to("/users/#{user.id.to_s}")
end

post '/scenes/:scene_id' do
  s = Scene.find params[:scene_id]

  if params[:start_xp]
    s.start_xp = params[:start_xp]
  end

  if params[:start_yp]
    s.start_yp = params[:start_yp]
  end

  if s.save!
    s.to_json
  else
    {error: 'blep'}.to_json
  end
end
